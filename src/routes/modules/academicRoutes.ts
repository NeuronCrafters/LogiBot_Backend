import { randomUUID } from "crypto";
import { Router } from "express";
import { asc, eq } from "drizzle-orm";
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
  universities,
} from "../../db/schema";
import { buildAcademicFilters } from "../../services/academic/academicFiltersService";
import { generateDisciplineCode } from "../../services/academic/disciplineCode";

export const academicRouter = Router();

academicRouter.use(requireAuth);

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
    const [classItem] = await getDb()
      .insert(classes)
      .values({ name, courseId })
      .returning();
    return res
      .status(201)
      .json({ message: "turma criada com sucesso", class: classItem });
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
    const [discipline] = await getDb()
      .insert(disciplines)
      .values({ name, courseId, code: randomUUID().slice(0, 8).toUpperCase() })
      .returning();
    const code = classIds[0]
      ? generateDisciplineCode(
          course.universityId,
          courseId,
          classIds[0],
          discipline.id,
        )
      : discipline.code;
    await getDb()
      .update(disciplines)
      .set({ code })
      .where(eq(disciplines.id, discipline.id));
    if (classIds.length)
      await getDb()
        .insert(classDisciplines)
        .values(
          classIds.map((classId) => ({ classId, disciplineId: discipline.id })),
        )
        .onConflictDoNothing();
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
        discipline: { ...discipline, code },
      });
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
