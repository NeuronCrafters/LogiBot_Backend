import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import {
  createStudentAccount,
  findEntitiesByDisciplineCode,
  getAccountByEmail,
  getAccountById,
  getPublicMe,
  startStudentSession,
} from "../../db/repositories/authRepository";
import { getDb } from "../db/client";
import { HttpError } from "../errors";
import { requireAuth } from "../http/auth";
import { clearAuthCookie, setAuthCookie } from "../security/cookies";
import { prioritizeRoles, signSession } from "../security/jwt";
import { hashPassword, verifyPassword } from "../security/password";
import { generateDisciplineCode } from "../services/disciplineCode";
import type { AppBindings } from "../types";

export const authRoutes = new Hono<AppBindings>();

function validateSignup(input: Record<string, unknown>) {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  const code = String(input.code || "").trim();

  if (!name || !email || !password || !code) {
    throw new HttpError("Os campos name, email, password e code sao obrigatorios.", 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError("formato de e-mail invalido!", 400);
  }

  if (password.length < 12) {
    throw new HttpError("a senha deve ter pelo menos 12 caracteres!", 400);
  }

  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ0-9\s]{3,}$/.test(name)) {
    throw new HttpError("nome invalido! deve conter ao menos 3 caracteres e nao pode conter simbolos especiais.", 400);
  }

  return { name, email, password, code };
}

authRoutes.post("/users", async (c) => {
  const body = validateSignup(await c.req.json<Record<string, unknown>>());
  const db = getDb(c.env);

  const existingUser = await getAccountByEmail(db, body.email);
  if (existingUser) {
    throw new HttpError("usuario ja existe com este email!", 409);
  }

  const entities = await findEntitiesByDisciplineCode(db, body.code);
  if (!entities) {
    throw new HttpError("codigo de disciplina invalido!", 404);
  }

  const { university, course, discipline, classes } = entities;
  if (classes.length === 0) {
    throw new HttpError("a disciplina nao possui turmas cadastradas!", 400);
  }

  let selectedClass = classes.find((classItem) => (
    generateDisciplineCode(university.id, course.id, classItem.id, discipline.id) === body.code
  ));
  if (!selectedClass) selectedClass = classes[0];

  const passwordHash = await hashPassword(body.password);
  const user = await createStudentAccount(db, {
    name: body.name,
    email: body.email,
    passwordHash,
    schoolId: university.id,
    courseId: course.id,
    classId: selectedClass.id,
    disciplineId: discipline.id,
  });
  if (!user) throw new HttpError("falha ao criar usuario.", 500);

  return c.json({
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
  }, 201);
});

authRoutes.post("/session", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = String(body.email || "").trim().toLowerCase();
  const db = getDb(c.env);
  const user = await getAccountByEmail(db, email);

  if (!user) throw new HttpError("credenciais invalidas.", 401);
  if (user.status !== "active") throw new HttpError("sua conta esta inativa. entre em contato com o administrador.", 403);

  if (!body.password) throw new HttpError("senha nao fornecida.", 400);
  if (!user.passwordHash) throw new HttpError("este usuario precisa redefinir sua senha. entre em contato com o administrador.", 401);
  const matches = await verifyPassword(body.password, user.passwordHash);
  if (!matches) throw new HttpError("credenciais invalidas.", 401);

  const roles = prioritizeRoles(user.roles || []);
  if (roles.includes("student")) {
    await startStudentSession(db, user);
  }

  const token = await signSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: roles,
    school: user.schoolId || null,
  }, c.env);
  setAuthCookie(c, token);

  return c.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: roles,
      school: user.schoolId,
      courses: roles.some((role) => ["professor", "course-coordinator"].includes(role)) ? (user.courses || []) : user.courseId,
      classes: roles.some((role) => ["professor", "course-coordinator"].includes(role)) ? (user.classes || []) : undefined,
      class: roles.includes("student") ? user.classId : undefined,
    },
    message: "login realizado com sucesso",
  });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const currentUser = c.get("user");
  if (!currentUser?.id) throw new HttpError("usuario nao encontrado", 404);

  const db = getDb(c.env);
  const account = await getAccountById(db, currentUser.id);
  if (!account) throw new HttpError("usuario nao encontrado!", 404);

  return c.json(await getPublicMe(db, account));
});

authRoutes.post("/logout", async (c) => {
  getCookie(c, "token");
  clearAuthCookie(c);
  return c.json({ message: "logout realizado com sucesso" });
});
