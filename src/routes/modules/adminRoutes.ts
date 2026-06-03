import { Router } from "express";
import bcrypt from "bcryptjs";
import { and, asc, eq, inArray } from "drizzle-orm";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import { getDb } from "../../db/client";
import {
  accountRoles,
  accounts,
  classDisciplines,
  classes,
  courses,
  disciplines,
  professorClasses,
  professorCourses,
  professorDisciplines,
  professorProfiles,
  studentProfiles,
} from "../../db/schema";

export const adminRouter = Router();

adminRouter.use(requireAuth);

adminRouter.post("/professors", requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const isAdmin = req.user!.role.includes("admin");
  const coordinatorCourseIds = Array.isArray(req.user!.courses) ? req.user!.courses as string[] : [];
  const schoolId = isAdmin ? String(req.body.school || req.body.schoolId || "") : String(req.user!.school || "");
  const courseIds = Array.isArray(req.body.courses) ? req.body.courses as string[] : [];
  const classIds = Array.isArray(req.body.classes) ? req.body.classes as string[] : [];
  const disciplineIds = Array.isArray(req.body.disciplines) ? req.body.disciplines as string[] : [];
  if (!name || !email || !password || !schoolId) throw new AppError("campos obrigatorios ausentes", 400);
  if (!isAdmin) {
    if (!courseIds.length) throw new AppError("selecione pelo menos um curso", 400);
    if (courseIds.some((courseId) => !coordinatorCourseIds.includes(courseId))) throw new AppError("coordenador so pode criar professor nos seus cursos", 403);

    if (classIds.length) {
      const classRows = await getDb().select().from(classes).where(inArray(classes.id, classIds));
      if (classRows.length !== classIds.length || classRows.some((item) => !coordinatorCourseIds.includes(item.courseId))) {
        throw new AppError("uma ou mais turmas nao pertencem aos cursos do coordenador", 403);
      }
    }

    if (disciplineIds.length) {
      const disciplineRows = await getDb().select().from(disciplines).where(inArray(disciplines.id, disciplineIds));
      if (disciplineRows.length !== disciplineIds.length || disciplineRows.some((item) => !coordinatorCourseIds.includes(item.courseId))) {
        throw new AppError("uma ou mais disciplinas nao pertencem aos cursos do coordenador", 403);
      }
    }
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [account] = await getDb().insert(accounts).values({ name, email, passwordHash, status: "active" }).returning();
  await getDb().insert(accountRoles).values({ accountId: account.id, role: "professor" }).onConflictDoNothing();
  await getDb().insert(professorProfiles).values({ accountId: account.id, schoolId }).onConflictDoNothing();
  if (courseIds.length) await getDb().insert(professorCourses).values(courseIds.map((courseId) => ({ professorId: account.id, courseId }))).onConflictDoNothing();
  if (classIds.length) await getDb().insert(professorClasses).values(classIds.map((classId) => ({ professorId: account.id, classId }))).onConflictDoNothing();
  if (disciplineIds.length) await getDb().insert(professorDisciplines).values(disciplineIds.map((disciplineId) => ({ professorId: account.id, disciplineId }))).onConflictDoNothing();
  return res.status(201).json({ message: "professor criado com sucesso", professor: { ...account, _id: account.id } });
}));

adminRouter.delete("/professors/:professorId", requireRoles(["admin"]), asyncHandler(async (req, res) => {
  await getDb().delete(accounts).where(eq(accounts.id, req.params.professorId));
  return res.json({ message: "professor removido com sucesso" });
}));

adminRouter.patch("/professors/:professorId", requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const isAdmin = req.user!.role.includes("admin");
  const coordinatorCourseIds = Array.isArray(req.user!.courses) ? req.user!.courses as string[] : [];
  const schoolId = isAdmin ? String(req.body.school || req.body.schoolId || "") : String(req.user!.school || "");
  const courseIds = Array.isArray(req.body.courses) ? [...new Set(req.body.courses as string[])] : [];

  if (!name || !email || !schoolId || !courseIds.length) throw new AppError("campos obrigatorios ausentes", 400);
  if (!isAdmin && courseIds.some((courseId) => !coordinatorCourseIds.includes(courseId))) {
    throw new AppError("coordenador so pode editar professor nos seus cursos", 403);
  }

  const courseRows = await getDb().select().from(courses).where(inArray(courses.id, courseIds));
  if (courseRows.length !== courseIds.length) throw new AppError("um ou mais cursos nao foram encontrados", 400);
  if (isAdmin && courseRows.some((course) => course.universityId !== schoolId)) {
    throw new AppError("um ou mais cursos nao pertencem a universidade selecionada", 400);
  }

  const accountUpdates: Partial<typeof accounts.$inferInsert> = { name, email, updatedAt: new Date() };
  if (password.trim()) accountUpdates.passwordHash = await bcrypt.hash(password, 10);

  const [account] = await getDb()
    .update(accounts)
    .set(accountUpdates)
    .where(eq(accounts.id, req.params.professorId))
    .returning();
  if (!account) throw new AppError("professor nao encontrado", 404);

  await getDb()
    .update(professorProfiles)
    .set({ schoolId })
    .where(eq(professorProfiles.accountId, req.params.professorId));

  await getDb().delete(professorCourses).where(eq(professorCourses.professorId, req.params.professorId));
  await getDb().insert(professorCourses)
    .values(courseIds.map((courseId) => ({ professorId: req.params.professorId, courseId })))
    .onConflictDoNothing();

  const [classLinks, disciplineLinks] = await Promise.all([
    getDb().select({ classId: professorClasses.classId, courseId: classes.courseId })
      .from(professorClasses)
      .innerJoin(classes, eq(classes.id, professorClasses.classId))
      .where(eq(professorClasses.professorId, req.params.professorId)),
    getDb().select({ disciplineId: professorDisciplines.disciplineId, courseId: disciplines.courseId })
      .from(professorDisciplines)
      .innerJoin(disciplines, eq(disciplines.id, professorDisciplines.disciplineId))
      .where(eq(professorDisciplines.professorId, req.params.professorId)),
  ]);

  for (const link of classLinks) {
    if (!courseIds.includes(link.courseId)) {
      await getDb().delete(professorClasses)
        .where(and(eq(professorClasses.professorId, req.params.professorId), eq(professorClasses.classId, link.classId)));
    }
  }
  for (const link of disciplineLinks) {
    if (!courseIds.includes(link.courseId)) {
      await getDb().delete(professorDisciplines)
        .where(and(eq(professorDisciplines.professorId, req.params.professorId), eq(professorDisciplines.disciplineId, link.disciplineId)));
    }
  }

  return res.json({ message: "professor atualizado com sucesso", professor: { ...account, _id: account.id } });
}));

adminRouter.get("/professors", requireRoles(["admin"]), asyncHandler(async (_req, res) => {
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo, schoolId: professorProfiles.schoolId }).from(accounts).innerJoin(professorProfiles, eq(professorProfiles.accountId, accounts.id)).orderBy(asc(accounts.name));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));

adminRouter.get("/universities/:schoolId/professors", requireRoles(["admin"]), asyncHandler(async (req, res) => {
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo }).from(accounts).innerJoin(professorProfiles, eq(professorProfiles.accountId, accounts.id)).where(eq(professorProfiles.schoolId, req.params.schoolId));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));

adminRouter.get("/courses/:courseId/professors", requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo }).from(accounts).innerJoin(professorCourses, eq(professorCourses.professorId, accounts.id)).where(eq(professorCourses.courseId, req.params.courseId));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));

adminRouter.patch("/professors/:id/role", requireRoles(["admin"]), asyncHandler(async (req, res) => {
  const action = String(req.body.action || "");
  if (action === "add") await getDb().insert(accountRoles).values({ accountId: req.params.id, role: "course-coordinator" }).onConflictDoNothing();
  else if (action === "remove") await getDb().delete(accountRoles).where(and(eq(accountRoles.accountId, req.params.id), eq(accountRoles.role, "course-coordinator")));
  else throw new AppError("action deve ser add ou remove", 400);
  return res.json({ message: "papel atualizado com sucesso" });
}));

adminRouter.get("/students", requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (_req, res) => {
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo, status: accounts.status, classId: studentProfiles.classId, courseId: studentProfiles.courseId, level: studentProfiles.level }).from(accounts).innerJoin(studentProfiles, eq(studentProfiles.accountId, accounts.id)).orderBy(asc(accounts.name));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));

adminRouter.delete("/students/:studentId", requireRoles(["admin"]), asyncHandler(async (req, res) => {
  await getDb().delete(accounts).where(eq(accounts.id, req.params.studentId));
  return res.json({ message: "aluno removido com sucesso" });
}));

adminRouter.get("/professor-students", requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const professorId = req.user!.id;
  const [directClassLinks, disciplineLinks] = await Promise.all([
    getDb().select({ classId: professorClasses.classId }).from(professorClasses).where(eq(professorClasses.professorId, professorId)),
    getDb().select({ disciplineId: professorDisciplines.disciplineId }).from(professorDisciplines).where(eq(professorDisciplines.professorId, professorId)),
  ]);

  const classIds = new Set(directClassLinks.map((link) => link.classId));
  if (disciplineLinks.length) {
    const classLinks = await getDb()
      .select({ classId: classDisciplines.classId })
      .from(classDisciplines)
      .where(inArray(classDisciplines.disciplineId, disciplineLinks.map((link) => link.disciplineId)));
    classLinks.forEach((link) => classIds.add(link.classId));
  }

  if (!classIds.size) return res.json([]);
  const studentRows = await getDb()
    .select({ studentId: studentProfiles.accountId })
    .from(studentProfiles)
    .where(inArray(studentProfiles.classId, [...classIds]));
  if (!studentRows.length) return res.json([]);

  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo }).from(accounts).where(inArray(accounts.id, [...new Set(studentRows.map((link) => link.studentId))]));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));

adminRouter.get("/coordinator/professors", requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const courseIds = Array.isArray(req.user!.courses) ? req.user!.courses as string[] : [];
  if (!courseIds.length && !req.user!.role.includes("admin")) return res.json([]);
  const rows = req.user!.role.includes("admin")
    ? await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email }).from(accounts).innerJoin(professorProfiles, eq(professorProfiles.accountId, accounts.id))
    : await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email }).from(accounts).innerJoin(professorCourses, eq(professorCourses.professorId, accounts.id)).where(inArray(professorCourses.courseId, courseIds));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));

adminRouter.get("/coordinator/students", requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const courseIds = Array.isArray(req.user!.courses) ? req.user!.courses as string[] : [];
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email }).from(accounts).innerJoin(studentProfiles, eq(studentProfiles.accountId, accounts.id)).where(req.user!.role.includes("admin") || !courseIds.length ? undefined : inArray(studentProfiles.courseId, courseIds));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));

adminRouter.get("/coordinator/disciplines/:disciplineId/students", requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const classLinks = await getDb()
    .select({ classId: classDisciplines.classId })
    .from(classDisciplines)
    .where(eq(classDisciplines.disciplineId, req.params.disciplineId));
  if (!classLinks.length) return res.json([]);

  const studentRows = await getDb()
    .select({ studentId: studentProfiles.accountId })
    .from(studentProfiles)
    .where(inArray(studentProfiles.classId, classLinks.map((link) => link.classId)));
  if (!studentRows.length) return res.json([]);

  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email }).from(accounts).where(inArray(accounts.id, [...new Set(studentRows.map((link) => link.studentId))]));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));

adminRouter.get("/coordinator/disciplines", requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const courseIds = Array.isArray(req.user!.courses) ? req.user!.courses as string[] : [];
  const rows = req.user!.role.includes("admin") || !courseIds.length ? await getDb().select().from(disciplines) : await getDb().select().from(disciplines).where(inArray(disciplines.courseId, courseIds));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));

adminRouter.get("/coordinator/classes", requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const courseIds = Array.isArray(req.user!.courses) ? req.user!.courses as string[] : [];
  const rows = req.user!.role.includes("admin") || !courseIds.length ? await getDb().select().from(classes) : await getDb().select().from(classes).where(inArray(classes.courseId, courseIds));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));

adminRouter.get("/classes/:classId/students", requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email }).from(accounts).innerJoin(studentProfiles, eq(studentProfiles.accountId, accounts.id)).where(eq(studentProfiles.classId, req.params.classId));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));
