import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireEnv, prioritizeRoles, signSession } from "../../http/auth";
import { clearAuthCookie, setAuthCookie } from "../../http/cookies";
import { getDb } from "../../db/client";
import { accounts, passwordHistory } from "../../db/schema";
import {
  createStudentAccount,
  findEntitiesByDisciplineCode,
  getAccountByEmail,
  getAccountById,
  getPublicMe,
  startStudentSession,
} from "../../db/repositories/authRepository";
import { sendPasswordResetEmail } from "../../services/email/mailService";
import { getFrontendOrigin } from "../../config/env";
import { closeOpenStudentSession, generateDisciplineCode } from "../routeHelpers";

export const authRouter = Router();

authRouter.post("/register", asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const code = String(req.body.code || "").trim();

  if (!name || !email || !password || !code) throw new AppError("Os campos name, email, password e code sao obrigatorios.", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("formato de e-mail invalido!", 400);
  if (password.length < 12) throw new AppError("a senha deve ter pelo menos 12 caracteres!", 400);

  const db = getDb();
  const existingUser = await getAccountByEmail(db, email);
  if (existingUser) throw new AppError("usuario ja existe com este email!", 409);

  const entities = await findEntitiesByDisciplineCode(db, code);
  if (!entities) throw new AppError("codigo de disciplina invalido!", 404);
  const { university, course, discipline, classes: linkedClasses } = entities;
  if (!linkedClasses.length) throw new AppError("a disciplina nao possui turmas cadastradas!", 400);

  const selectedClass = linkedClasses.find((item) => generateDisciplineCode(university.id, course.id, item.id, discipline.id) === code) || linkedClasses[0];
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createStudentAccount(db, {
    name,
    email,
    passwordHash,
    schoolId: university.id,
    courseId: course.id,
    classId: selectedClass.id,
    disciplineId: discipline.id,
  });
  if (!user) throw new AppError("falha ao criar usuario.", 500);

  return res.status(201).json({
    message: "Usuario criado com sucesso!",
    user: {
      user: {
        _id: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.roles,
        school: { _id: university.id, id: university.id, name: university.name },
        course: { _id: course.id, id: course.id, name: course.name },
        class: { _id: selectedClass.id, id: selectedClass.id, name: selectedClass.name },
        disciplines: [{ _id: discipline.id, id: discipline.id, name: discipline.name, code: discipline.code }],
      },
      assignedClass: { id: selectedClass.id, name: selectedClass.name },
      discipline: { id: discipline.id, name: discipline.name },
      course: { id: course.id, name: course.name },
      university: { id: university.id, name: university.name },
    },
  });
}));

authRouter.post("/session", asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const db = getDb();
  const user = await getAccountByEmail(db, email);
  if (!user || !password || !user.passwordHash) throw new AppError("credenciais invalidas.", 401);
  if (user.status !== "active") throw new AppError("sua conta esta inativa. entre em contato com o administrador.", 403);
  if (!await bcrypt.compare(password, user.passwordHash)) throw new AppError("credenciais invalidas.", 401);

  const roles = prioritizeRoles(user.roles || []);
  if (roles.includes("student")) await startStudentSession(db, user);
  const token = signSession({ id: user.id, name: user.name, email: user.email, role: roles, school: user.schoolId || null });
  setAuthCookie(req, res, token);

  return res.json({
    success: true,
    user: {
      id: user.id,
      _id: user.id,
      name: user.name,
      email: user.email,
      role: roles,
      school: user.schoolId,
      courses: roles.some((role) => ["professor", "course-coordinator"].includes(role)) ? (user.courses || []) : user.courseId,
      classes: roles.some((role) => ["professor", "course-coordinator"].includes(role)) ? (user.classes || []) : undefined,
      class: roles.includes("student") ? user.classId : undefined,
      disciplines: user.disciplines || [],
    },
  });
}));

authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const account = await getAccountById(getDb(), req.user!.id);
  if (!account) throw new AppError("usuario nao encontrado", 404);
  return res.json(await getPublicMe(getDb(), account));
}));

authRouter.post("/logout", requireAuth, asyncHandler(async (req, res) => {
  if (req.user?.role.includes("student")) await closeOpenStudentSession(req.user.id);
  clearAuthCookie(req, res);
  return res.json({ message: "logout realizado com sucesso" });
}));

authRouter.post("/password-reset-requests", asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const account = await getAccountByEmail(getDb(), email);
  if (!account) return res.json({ message: "se o email existir, a recuperacao sera iniciada" });
  const token = jwt.sign({ email }, requireEnv("JWT_SECRET"), { expiresIn: "30m" });
  const frontendUrl = getFrontendOrigin(req.get("origin"));
  const resetLink = `${frontendUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

  await getDb().update(accounts)
    .set({ resetPasswordToken: token, resetPasswordExpires: new Date(Date.now() + 30 * 60 * 1000), updatedAt: new Date() })
    .where(eq(accounts.id, account.id));

  await sendPasswordResetEmail({ to: account.email, name: account.name, resetLink });
  const includeDebugResetData = process.env.PASSWORD_RESET_DEBUG_RESPONSE === "true";

  return res.json({
    message: "se o email existir, a recuperacao sera iniciada",
    resetToken: includeDebugResetData ? token : undefined,
    resetLink: includeDebugResetData ? resetLink : undefined,
  });
}));

authRouter.patch("/password-reset", asyncHandler(async (req, res) => {
  const token = String(req.body.token || "");
  const newPassword = String(req.body.newPassword || "");
  if (!token || !newPassword) throw new AppError("token e newPassword sao obrigatorios", 400);
  const decoded = jwt.verify(token, requireEnv("JWT_SECRET")) as { email?: string };
  const [account] = await getDb().select().from(accounts).where(eq(accounts.email, String(decoded.email || "").toLowerCase())).limit(1);
  if (!account || account.resetPasswordToken !== token || !account.resetPasswordExpires || new Date() > account.resetPasswordExpires) {
    throw new AppError("token invalido ou expirado.", 400);
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await getDb().insert(passwordHistory).values({ accountId: account.id, hash: account.passwordHash || "" });
  await getDb().update(accounts)
    .set({ passwordHash: hash, resetPasswordToken: null, resetPasswordExpires: null, updatedAt: new Date() })
    .where(eq(accounts.id, account.id));
  return res.json({ message: "senha redefinida com sucesso" });
}));
