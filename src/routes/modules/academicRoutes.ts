import { Router, type Request } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import { getDb } from "../../db/client";
import {
  classes,
  classDisciplines,
  courses,
  disciplines,
  professorDisciplines,
  professorCourses,
  universities,
} from "../../db/schema";
import { buildAcademicFilters } from "../../services/academic/academicFiltersService";
import { generateUniqueRegistrationCode } from "../../services/academic/disciplineCode";

export const academicRouter = Router();

academicRouter.use(requireAuth);

async function assertCanManageCourse(req: Request, courseId: string) {
  if (req.user!.role.includes("admin")) return;
  const allowedCourseIds = Array.isArray(req.user!.courses) ? req.user!.courses as string[] : [];
  if (!allowedCourseIds.includes(courseId)) throw new AppError("acesso negado para este curso", 403);
}

async function ensureClassDisciplineLinks(classIds: string[], disciplineId: string) {
  const db = getDb();
  const registrationCodes: Array<{ classId: string; disciplineId: string; code: string }> = [];

  for (const classId of classIds) {
    const [existing] = await db.select()
      .from(classDisciplines)
      .where(and(eq(classDisciplines.classId, classId), eq(classDisciplines.disciplineId, disciplineId)))
      .limit(1);

    if (existing?.code) {
      registrationCodes.push({ classId, disciplineId, code: existing.code });
      continue;
    }

    const code = await generateUniqueRegistrationCode(db);

    if (existing) {
      await db.update(classDisciplines)
        .set({ code })
        .where(and(eq(classDisciplines.classId, classId), eq(classDisciplines.disciplineId, disciplineId)));
    } else {
      await db.insert(classDisciplines)
        .values({ classId, disciplineId, code })
        .onConflictDoNothing();
    }

    registrationCodes.push({ classId, disciplineId, code });
  }

  return registrationCodes;
}

academicRouter.get(
  "/filters",
  requireRoles(["admin", "professor", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    return res.json(await buildAcademicFilters(req.user!));
  }),
);

academicRouter.post(
  "/universities",
  requireRoles(["admin"]),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) throw new AppError("nome obrigatorio", 400);
    const [university] = await getDb()
      .insert(universities)
      .values({ name })
      .returning();
    return res
      .status(201)
      .json({ message: "universidade criada com sucesso", university });
  }),
);

academicRouter.get(
  "/universities",
  requireRoles(["admin"]),
  asyncHandler(async (_req, res) => {
    return res.json(
      await getDb().select().from(universities).orderBy(asc(universities.name)),
    );
  }),
);

academicRouter.delete(
  "/universities/:universityId",
  requireRoles(["admin"]),
  asyncHandler(async (req, res) => {
    await getDb()
      .delete(universities)
      .where(eq(universities.id, req.params.universityId));
    return res.json({ message: "universidade removida com sucesso" });
  }),
);

academicRouter.post(
  "/courses",
  requireRoles(["admin"]),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const universityId = String(
      req.body.universityId || req.body.university || "",
    );
    const [course] = await getDb()
      .insert(courses)
      .values({ name, universityId })
      .returning();
    return res
      .status(201)
      .json({ message: "curso criado com sucesso", course });
  }),
);

academicRouter.get(
  "/universities/:universityId/courses",
  requireRoles(["admin"]),
  asyncHandler(async (req, res) => {
    return res.json(
      await getDb()
        .select()
        .from(courses)
        .where(eq(courses.universityId, req.params.universityId))
        .orderBy(asc(courses.name)),
    );
  }),
);

academicRouter.delete(
  "/courses/:courseId",
  requireRoles(["admin"]),
  asyncHandler(async (req, res) => {
    await getDb().delete(courses).where(eq(courses.id, req.params.courseId));
    return res.json({ message: "curso removido com sucesso" });
  }),
);

academicRouter.post(
  "/classes",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const courseId = String(req.body.courseId || req.body.course || "");
    const disciplineIds = Array.isArray(req.body.disciplineIds)
      ? (req.body.disciplineIds as string[])
      : [];
    await assertCanManageCourse(req, courseId);
    const [classItem] = await getDb()
      .insert(classes)
      .values({ name, courseId })
      .returning();
    const registrationCodes = disciplineIds.length
      ? (await Promise.all(disciplineIds.map(async (disciplineId) => {
          const [discipline] = await getDb().select().from(disciplines).where(eq(disciplines.id, disciplineId)).limit(1);
          if (!discipline || discipline.courseId !== courseId) throw new AppError("disciplina invalida para este curso", 400);
          return ensureClassDisciplineLinks([classItem.id], disciplineId);
        }))).flat()
      : [];
    return res
      .status(201)
      .json({ message: "turma criada com sucesso", class: classItem, registrationCodes });
  }),
);

academicRouter.get(
  "/courses/:courseId/classes",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    return res.json(
      await getDb()
        .select()
        .from(classes)
        .where(eq(classes.courseId, req.params.courseId))
        .orderBy(asc(classes.name)),
    );
  }),
);

academicRouter.delete(
  "/classes/:classId",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    await getDb().delete(classes).where(eq(classes.id, req.params.classId));
    return res.json({ message: "turma removida com sucesso" });
  }),
);

academicRouter.post(
  "/disciplines",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const courseId = String(req.body.courseId || req.body.course || "");
    const classIds = Array.isArray(req.body.classIds)
      ? (req.body.classIds as string[])
      : [];
    const professorIds = Array.isArray(req.body.professorIds)
      ? (req.body.professorIds as string[])
      : [];
    const [course] = await getDb()
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!course) throw new AppError("curso nao encontrado", 404);
    await assertCanManageCourse(req, courseId);
    if (classIds.length) {
      const classRows = await getDb().select().from(classes).where(inArray(classes.id, classIds));
      if (classRows.length !== classIds.length || classRows.some((item) => item.courseId !== courseId)) {
        throw new AppError("uma ou mais turmas nao pertencem ao curso selecionado", 400);
      }
    }
    if (professorIds.length) {
      const professorCourseRows = await getDb().select().from(professorCourses).where(inArray(professorCourses.professorId, professorIds));
      const invalidProfessor = professorIds.some((professorId) => !professorCourseRows.some((link) => link.professorId === professorId && link.courseId === courseId));
      if (invalidProfessor) throw new AppError("um ou mais professores nao pertencem ao curso selecionado", 400);
    }
    const [discipline] = await getDb()
      .insert(disciplines)
      .values({ name, courseId, code: await generateUniqueRegistrationCode(getDb()) })
      .returning();
    const registrationCodes = classIds.length ? await ensureClassDisciplineLinks(classIds, discipline.id) : [];
    if (professorIds.length)
      await getDb()
        .insert(professorDisciplines)
        .values(
          professorIds.map((professorId) => ({
            professorId,
            disciplineId: discipline.id,
          })),
        )
        .onConflictDoNothing();
    return res
      .status(201)
      .json({
        message: "disciplina criada com sucesso",
        discipline,
        registrationCodes,
      });
  }),
);

academicRouter.post(
  "/disciplines/:disciplineId/professors",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const professorId = String(req.body.professorId || "");
    if (!professorId) throw new AppError("professorId e obrigatorio", 400);

    const [discipline] = await getDb().select().from(disciplines).where(eq(disciplines.id, req.params.disciplineId)).limit(1);
    if (!discipline) throw new AppError("disciplina nao encontrada", 404);
    await assertCanManageCourse(req, discipline.courseId);

    const [professorCourse] = await getDb().select()
      .from(professorCourses)
      .where(and(eq(professorCourses.professorId, professorId), eq(professorCourses.courseId, discipline.courseId)))
      .limit(1);
    if (!professorCourse) throw new AppError("professor nao pertence ao curso da disciplina", 400);

    await getDb().insert(professorDisciplines)
      .values({ professorId, disciplineId: discipline.id })
      .onConflictDoNothing();

    return res.json({ message: "professor vinculado a disciplina com sucesso" });
  }),
);

academicRouter.post(
  "/classes/:classId/disciplines",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const disciplineId = String(req.body.disciplineId || "");
    if (!disciplineId) throw new AppError("disciplineId e obrigatorio", 400);

    const [[classItem], [discipline]] = await Promise.all([
      getDb().select().from(classes).where(eq(classes.id, req.params.classId)).limit(1),
      getDb().select().from(disciplines).where(eq(disciplines.id, disciplineId)).limit(1),
    ]);
    if (!classItem) throw new AppError("turma nao encontrada", 404);
    if (!discipline) throw new AppError("disciplina nao encontrada", 404);
    if (classItem.courseId !== discipline.courseId) throw new AppError("turma e disciplina devem pertencer ao mesmo curso", 400);
    await assertCanManageCourse(req, classItem.courseId);

    const registrationCodes = await ensureClassDisciplineLinks([classItem.id], discipline.id);
    return res.json({ message: "disciplina vinculada a turma com sucesso", registrationCodes });
  }),
);

academicRouter.delete(
  "/classes/:classId/disciplines/:disciplineId",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const [classItem] = await getDb().select().from(classes).where(eq(classes.id, req.params.classId)).limit(1);
    if (!classItem) throw new AppError("turma nao encontrada", 404);
    await assertCanManageCourse(req, classItem.courseId);

    await getDb().delete(classDisciplines)
      .where(and(eq(classDisciplines.classId, req.params.classId), eq(classDisciplines.disciplineId, req.params.disciplineId)));

    return res.json({ message: "disciplina desvinculada da turma com sucesso" });
  }),
);

academicRouter.delete(
  "/disciplines/:disciplineId/professors/:professorId",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const [discipline] = await getDb().select().from(disciplines).where(eq(disciplines.id, req.params.disciplineId)).limit(1);
    if (!discipline) throw new AppError("disciplina nao encontrada", 404);
    await assertCanManageCourse(req, discipline.courseId);

    await getDb().delete(professorDisciplines)
      .where(and(eq(professorDisciplines.professorId, req.params.professorId), eq(professorDisciplines.disciplineId, discipline.id)));

    return res.json({ message: "professor desvinculado da disciplina com sucesso" });
  }),
);

academicRouter.get(
  "/disciplines",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (_req, res) => {
    return res.json(
      await getDb().select().from(disciplines).orderBy(asc(disciplines.name)),
    );
  }),
);

academicRouter.delete(
  "/disciplines/:disciplineId",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    await getDb()
      .delete(disciplines)
      .where(eq(disciplines.id, req.params.disciplineId));
    return res.json({ message: "disciplina removida com sucesso" });
  }),
);
