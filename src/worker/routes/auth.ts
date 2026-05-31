import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { ObjectId } from "mongodb";
import { collections } from "../db/collections";
import { getDb } from "../db/client";
import { HttpError } from "../errors";
import { clearAuthCookie, setAuthCookie } from "../security/cookies";
import { prioritizeRoles, signSession } from "../security/jwt";
import { hashPassword, verifyPassword } from "../security/password";
import { generateDisciplineCode, findEntitiesByCode } from "../services/disciplineCode";
import { startStudentSession } from "../services/userAnalysis";
import type { AppBindings, ProfessorDocument, StudentDocument } from "../types";
import { requireAuth } from "../http/auth";

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
  const db = await getDb(c.env);
  const col = collections(db);

  const existingUser = await col.users.findOne({ email: body.email });
  if (existingUser) {
    throw new HttpError("usuario ja existe com este email!", 409);
  }

  const entities = await findEntitiesByCode(col, body.code);
  if (!entities) {
    throw new HttpError("codigo de disciplina invalido!", 404);
  }

  const { university, course, discipline, classes } = entities;
  if (!university._id || !course._id || !discipline._id) {
    throw new HttpError("dados academicos incompletos para o codigo informado", 400);
  }

  if (classes.length === 0) {
    throw new HttpError("a disciplina nao possui turmas cadastradas!", 400);
  }

  let selectedClass = classes.find((classItem) => (
    generateDisciplineCode(String(university._id), String(course._id), String(classItem._id), String(discipline._id)) === body.code
  ));

  if (!selectedClass) selectedClass = classes[0];
  if (!selectedClass._id) {
    throw new HttpError("turma vinculada ao codigo esta invalida", 400);
  }

  const now = new Date();
  const password = await hashPassword(body.password);
  const insertResult = await col.users.insertOne({
    name: body.name,
    email: body.email,
    password,
    previousPasswords: [],
    school: university._id,
    course: course._id,
    class: selectedClass._id,
    disciplines: [discipline._id],
    role: ["student"],
    status: "active",
    level: "desconhecido",
    createdAt: now,
    updatedAt: now,
  });

  await Promise.all([
    col.disciplines.updateOne({ _id: discipline._id }, { $addToSet: { students: insertResult.insertedId } }),
    col.classes.updateOne({ _id: selectedClass._id }, { $addToSet: { students: insertResult.insertedId } }),
  ]);

  const user = await col.users.findOne({ _id: insertResult.insertedId }, { projection: { password: 0, previousPasswords: 0 } });

  return c.json({
    message: "Usuario criado com sucesso!",
    user: {
      user: {
        ...user,
        school: { _id: university._id, name: university.name },
        course: { _id: course._id, name: course.name },
        class: { _id: selectedClass._id, name: selectedClass.name },
        disciplines: [{ _id: discipline._id, name: discipline.name, code: discipline.code }],
      },
      assignedClass: { id: selectedClass._id, name: selectedClass.name },
      discipline: { id: discipline._id, name: discipline.name },
      course: { id: course._id, name: course.name },
      university: { id: university._id, name: university.name },
    },
  }, 201);
});

authRoutes.post("/session", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = String(body.email || "").trim().toLowerCase();
  const db = await getDb(c.env);
  const col = collections(db);

  let user = await col.professors.findOne({ email });
  let isProfessor = Boolean(user);
  if (!user) {
    user = await col.users.findOne({ email });
    isProfessor = false;
  }

  if (!user) throw new HttpError("credenciais invalidas.", 401);
  if (user.status !== "active") throw new HttpError("sua conta esta inativa. entre em contato com o administrador.", 403);

  if (!body.password) throw new HttpError("senha nao fornecida.", 400);
  if (!user.password) throw new HttpError("este usuario precisa redefinir sua senha. entre em contato com o administrador.", 401);
  const matches = await verifyPassword(body.password, user.password);
  if (!matches) throw new HttpError("credenciais invalidas.", 401);

  const roles = prioritizeRoles(user.role || []);
  if (!isProfessor && roles.includes("student")) {
    await startStudentSession(col, user as StudentDocument);
  }

  const token = await signSession({
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: roles,
    school: user.school ? String(user.school) : null,
  }, c.env);
  setAuthCookie(c, token);

  return c.json({
    success: true,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: roles,
      school: user.school,
      courses: isProfessor ? (user as ProfessorDocument).courses : (user as StudentDocument).course,
      classes: isProfessor ? ((user as ProfessorDocument).classes || []) : undefined,
      class: isProfessor ? undefined : (user as StudentDocument).class,
    },
    message: "login realizado com sucesso",
  });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const currentUser = c.get("user");
  if (!currentUser || !ObjectId.isValid(currentUser.id)) throw new HttpError("usuario nao encontrado", 404);

  const db = await getDb(c.env);
  const col = collections(db);
  const id = new ObjectId(currentUser.id);
  const isProfessor = currentUser.role.some((role) => ["professor", "course-coordinator"].includes(role));
  const raw = isProfessor
    ? await col.professors.findOne({ _id: id }, { projection: { password: 0, previousPasswords: 0 } })
    : await col.users.findOne({ _id: id }, { projection: { password: 0, previousPasswords: 0 } });

  if (!raw) throw new HttpError("usuario nao encontrado!", 404);

  const [school, course, classDoc, courses, classes, disciplines] = await Promise.all([
    raw.school ? col.universities.findOne({ _id: new ObjectId(String(raw.school)) }) : null,
    "course" in raw && raw.course ? col.courses.findOne({ _id: new ObjectId(String(raw.course)) }) : null,
    "class" in raw && raw.class ? col.classes.findOne({ _id: new ObjectId(String(raw.class)) }) : null,
    "courses" in raw && raw.courses?.length ? col.courses.find({ _id: { $in: raw.courses } }).toArray() : [],
    "classes" in raw && raw.classes?.length ? col.classes.find({ _id: { $in: raw.classes } }).toArray() : [],
    "disciplines" in raw && raw.disciplines?.length ? col.disciplines.find({ _id: { $in: raw.disciplines } }).toArray() : [],
  ]);

  return c.json({
    _id: String(raw._id),
    name: raw.name,
    email: raw.email,
    role: raw.role,
    schoolId: school ? String(school._id) : "",
    schoolName: school?.name || "",
    courseId: course ? String(course._id) : undefined,
    courseName: course?.name,
    classId: classDoc ? String(classDoc._id) : undefined,
    className: classDoc?.name,
    courses: courses.map((item) => ({ id: String(item._id), name: item.name })),
    classes: classes.map((item) => ({ id: String(item._id), name: item.name })),
    disciplines: disciplines.map((item) => ({ id: String(item._id), name: item.name, code: item.code || "" })),
  });
});

authRoutes.post("/logout", async (c) => {
  getCookie(c, "token");
  clearAuthCookie(c);
  return c.json({ message: "logout realizado com sucesso" });
});
