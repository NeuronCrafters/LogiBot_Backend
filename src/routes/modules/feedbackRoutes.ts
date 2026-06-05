import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import { getDb } from "../../db/client";
import { accounts, feedbacks } from "../../db/schema";

export const feedbackRouter = Router();

feedbackRouter.use(requireAuth);

feedbackRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const message = String(req.body.message || "").trim();
    const type = String(req.body.type || "general");
    if (!message) throw new AppError("a mensagem e obrigatoria.", 400);
    const [account] = await getDb()
      .select()
      .from(accounts)
      .where(eq(accounts.id, req.user!.id))
      .limit(1);
    if (!account) throw new AppError("usuario nao encontrado.", 404);
    const isVip =
      req.user!.role.includes("admin") ||
      req.user!.role.includes("course-coordinator");
    if (!isVip && account.lastFeedbackAt) {
      const diffMinutes =
        (Date.now() - new Date(account.lastFeedbackAt).getTime()) / (1000 * 60);
      if (diffMinutes < 2)
        throw new AppError(
          `aguarde ${Math.ceil(2 - diffMinutes)} minuto(s) para enviar novamente.`,
          429,
        );
    }
    await getDb()
      .insert(feedbacks)
      .values({ accountId: account.id, type, message });
    await getDb()
      .update(accounts)
      .set({ lastFeedbackAt: new Date(), updatedAt: new Date() })
      .where(eq(accounts.id, account.id));
    return res.json({ message: "feedback enviado com sucesso!" });
  }),
);

feedbackRouter.get(
  "/",
  requireRoles(["admin"]),
  asyncHandler(async (_req, res) => {
    const rows = await getDb()
      .select({
        id: feedbacks.id,
        type: feedbacks.type,
        message: feedbacks.message,
        createdAt: feedbacks.createdAt,
        authorName: accounts.name,
        authorEmail: accounts.email,
      })
      .from(feedbacks)
      .leftJoin(accounts, eq(feedbacks.accountId, accounts.id))
      .orderBy(desc(feedbacks.createdAt));

    return res.json(rows);
  }),
);
