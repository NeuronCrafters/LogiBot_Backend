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

accountRouter.patch("/password", asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) throw new AppError("senha atual e nova senha sao obrigatorias", 400);
  if (newPassword.length < 6) throw new AppError("a nova senha deve ter no minimo 6 caracteres", 400);

  const db = getDb();
  const [account] = await db.select().from(accounts).where(eq(accounts.id, req.user!.id)).limit(1);
  if (!account?.passwordHash) throw new AppError("usuario nao encontrado", 404);
  if (!await bcrypt.compare(currentPassword, account.passwordHash)) throw new AppError("senha atual invalida", 401);

  const hash = await bcrypt.hash(newPassword, 10);
  await db.insert(passwordHistory).values({ accountId: account.id, hash: account.passwordHash });
  await db.update(accounts).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(accounts.id, account.id));
  return res.json({ message: "senha atualizada com sucesso" });
}));

accountRouter.patch("/name", asyncHandler(async (req, res) => {
  const userId = String(req.body.userId || req.user!.id);
  if (userId !== req.user!.id && !req.user!.role.includes("admin")) throw new AppError("acesso negado", 403);
  const name = String(req.body.name || req.body.newName || "").trim();
  if (!name) throw new AppError("nome obrigatorio", 400);
  const [account] = await getDb().update(accounts).set({ name, updatedAt: new Date() }).where(eq(accounts.id, userId)).returning();
  if (!account) throw new AppError("usuario nao encontrado", 404);
  return res.json({ message: "nome atualizado com sucesso", user: { id: account.id, _id: account.id, name: account.name, email: account.email } });
}));

accountRouter.patch("/email", asyncHandler(async (req, res) => {
  const userId = String(req.body.userId || req.user!.id);
  if (userId !== req.user!.id && !req.user!.role.includes("admin")) throw new AppError("acesso negado", 403);
  const email = String(req.body.email || req.body.newEmail || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("email invalido", 400);
  const existing = await getAccountByEmail(getDb(), email);
  if (existing && existing.id !== userId) throw new AppError("email ja esta em uso", 409);
  const [account] = await getDb().update(accounts).set({ email, updatedAt: new Date() }).where(eq(accounts.id, userId)).returning();
  await getDb().update(userAnalyses).set({ email }).where(eq(userAnalyses.userId, userId));
  return res.json({ message: "email atualizado com sucesso", user: { id: account.id, _id: account.id, name: account.name, email: account.email } });
}));
