import { getLanguage, normalizeLanguage } from "../../i18n";
import { accountLanguage } from "../../i18n/middleware";
import { t } from "../../i18n";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth } from "../../http/auth";
import { getDb } from "../../db/client";
import { accounts, passwordHistory, userAnalyses } from "../../db/schema";
import { getAccountByEmail } from "../../db/repositories/authRepository";

export const accountRouter = Router();

accountRouter.use(requireAuth);

accountRouter.patch(
  "/password",
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword)
      throw new AppError("account.passwordsRequired", 400);
    if (newPassword.length < 6)
      throw new AppError("account.passwordTooShort", 400);

    const db = getDb();
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, req.user!.id))
      .limit(1);
    if (!account?.passwordHash)
      throw new AppError("auth.userNotFound", 404);
    if (!(await bcrypt.compare(currentPassword, account.passwordHash)))
      throw new AppError("account.currentPasswordInvalid", 401);

    const hash = await bcrypt.hash(newPassword, 10);
    await db
      .insert(passwordHistory)
      .values({ accountId: account.id, hash: account.passwordHash });
    await db
      .update(accounts)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(accounts.id, account.id));
    return res.json({ message: t("account.passwordUpdated") });
  }),
);

accountRouter.patch(
  "/name",
  asyncHandler(async (req, res) => {
    const userId = String(req.body.userId || req.user!.id);
    if (userId !== req.user!.id && !req.user!.role.includes("admin"))
      throw new AppError("auth.accessDenied", 403);
    const name = String(req.body.name || req.body.newName || "").trim();
    if (!name) throw new AppError("account.nameRequired", 400);
    const [account] = await getDb()
      .update(accounts)
      .set({ name, updatedAt: new Date() })
      .where(eq(accounts.id, userId))
      .returning();
    if (!account) throw new AppError("auth.userNotFound", 404);
    return res.json({
      message: t("account.nameUpdated"),
      user: {
        id: account.id,
        _id: account.id,
        name: account.name,
        email: account.email,
      },
    });
  }),
);

accountRouter.patch(
  "/email",
  asyncHandler(async (req, res) => {
    const userId = String(req.body.userId || req.user!.id);
    if (userId !== req.user!.id && !req.user!.role.includes("admin"))
      throw new AppError("auth.accessDenied", 403);
    const email = String(req.body.email || req.body.newEmail || "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new AppError("account.emailInvalid", 400);
    const existing = await getAccountByEmail(getDb(), email);
    if (existing && existing.id !== userId)
      throw new AppError("account.emailInUse", 409);
    const [account] = await getDb()
      .update(accounts)
      .set({ email, updatedAt: new Date() })
      .where(eq(accounts.id, userId))
      .returning();
    await getDb()
      .update(userAnalyses)
      .set({ email })
      .where(eq(userAnalyses.userId, userId));
    return res.json({
      message: t("account.emailUpdated"),
      user: {
        id: account.id,
        _id: account.id,
        name: account.name,
        email: account.email,
      },
    });
  }),
);

accountRouter.patch(
  "/preferences",
  asyncHandler(async (req, res) => {
    const input = req.body.language;
    const language = input === null ? null : normalizeLanguage(input);
    if (language === undefined) throw new AppError("language.invalid", 400);
    const [account] = await getDb().update(accounts)
      .set({ preferredLanguage: language, updatedAt: new Date() })
      .where(eq(accounts.id, req.user!.id))
      .returning();
    accountLanguage(req, res, account.preferredLanguage);
    return res.json({ message: t("language.preferenceUpdated"), preferredLanguage: account.preferredLanguage, language: getLanguage() });
  }),
);
