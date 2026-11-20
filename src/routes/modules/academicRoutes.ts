import { t } from "../../i18n";
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
  studentProfiles,
  universities,
} from "../../db/schema";
import { buildAcademicFilters } from "../../services/academic/academicFiltersService";
import { assertCourseInNetwork, assertDisciplineInNetwork, coordinatedCourses, requireNetwork, seesEveryNetwork } from "../../services/academic/networkScope";
import { generateUniqueRegistrationCode } from "../../services/academic/disciplineCode";

export const academicRouter = Router();

academicRouter.use(requireAuth);

async function assertCanManageCourse(req: Request, courseId: string) {
  if (req.user!.role.includes("admin")) return;
  const allowedCourseIds = Array.isArray(req.user!.courses)
    ? (req.user!.courses as string[])
    : [];
  if (!allowedCourseIds.includes(courseId))
    throw new AppError("dashboard.courseDenied", 403);
}

async function ensureClassDisciplineLinks(
  classIds: string[],
  disciplineId: string,
) {
  const db = getDb();

  for (const classId of classIds) {
    await db
      .insert(classDisciplines)
      .values({ classId, disciplineId })
      .onConflictDoNothing();
  }
}

async function replaceDisciplineLinksForClass(
  classId: string,
  disciplineIds: string[],
) {
  const db = getDb();

  for (const disciplineId of disciplineIds) {
    await ensureClassDisciplineLinks([classId], disciplineId);
  }

  const existingLinks = await db
    .select()
    .from(classDisciplines)
    .where(eq(classDisciplines.classId, classId));
  for (const link of existingLinks) {
    if (!disciplineIds.includes(link.disciplineId)) {
      await db
        .delete(classDisciplines)
        .where(
          and(
            eq(classDisciplines.classId, classId),
            eq(classDisciplines.disciplineId, link.disciplineId),
          ),
        );
    }
  }
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
    if (!name) throw new AppError("account.nameRequired", 400);
    const [university] = await getDb()
      .insert(universities)
      .values({ name })
      .returning();
    return res
      .status(201)
      .json({ message: t("academic.universityCreated"), university });
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
    return res.json({ message: t("academic.universityRemoved") });
  }),
);

academicRouter.patch(
  "/universities/:universityId",
  requireRoles(["admin"]),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) throw new AppError("account.nameRequired", 400);

    const [university] = await getDb()
      .update(universities)
      .set({ name, updatedAt: new Date() })
      .where(eq(universities.id, req.params.universityId))
      .returning();

    if (!university) throw new AppError("academic.universityNotFound", 404);
    return res.json({
      message: t("academic.universityUpdated"),
      university,
    });
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
      .json({ message: t("academic.courseCreated"), course });
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
    return res.json({ message: t("academic.courseRemoved") });
  }),
);

academicRouter.patch(
  "/courses/:courseId",
  requireRoles(["admin"]),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const universityId = String(
      req.body.universityId || req.body.university || "",
    );
    if (!name || !universityId)
      throw new AppError("academic.nameUniversityRequired", 400);

    const [university] = await getDb()
      .select()
      .from(universities)
      .where(eq(universities.id, universityId))
      .limit(1);
    if (!university) throw new AppError("academic.universityNotFound", 404);

    const [course] = await getDb()
      .update(courses)
      .set({ name, universityId, updatedAt: new Date() })
      .where(eq(courses.id, req.params.courseId))
      .returning();

    if (!course) throw new AppError("academic.courseNotFound", 404);
    return res.json({ message: t("academic.courseUpdated"), course });
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
    const registrationCode = await generateUniqueRegistrationCode(getDb());
    const [classItem] = await getDb()
      .insert(classes)
      .values({ name, courseId, registrationCode })
      .returning();
    if (disciplineIds.length) {
      await Promise.all(
        disciplineIds.map(async (disciplineId) => {
          const [discipline] = await getDb()
            .select()
            .from(disciplines)
            .where(eq(disciplines.id, disciplineId))
            .limit(1);
          if (!discipline || discipline.courseId !== courseId)
            throw new AppError("academic.disciplineOutsideCourse", 400);
          await ensureClassDisciplineLinks([classItem.id], disciplineId);
        }),
      );
    }
    return res
      .status(201)
      .json({
        message: t("academic.classCreated"),
        class: classItem,
        registrationCode: classItem.registrationCode,
      });
  }),
);

academicRouter.patch(
  "/classes/:classId",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const courseId = String(req.body.courseId || req.body.course || "");
    const disciplineIds = Array.isArray(req.body.disciplineIds)
      ? [...new Set(req.body.disciplineIds as string[])]
      : undefined;
    if (!name || !courseId)
      throw new AppError("academic.nameCourseRequired", 400);

    const [course] = await getDb()
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!course) throw new AppError("academic.courseNotFound", 404);
    await assertCanManageCourse(req, courseId);

    if (disciplineIds?.length) {
      const disciplineRows = await getDb()
        .select()
        .from(disciplines)
        .where(inArray(disciplines.id, disciplineIds));
      if (
        disciplineRows.length !== disciplineIds.length ||
        disciplineRows.some((item) => item.courseId !== courseId)
      ) {
        throw new AppError("academic.disciplinesOutsideCourse",
          400,
        );
      }
    }

    const [classItem] = await getDb()
      .update(classes)
      .set({ name, courseId, updatedAt: new Date() })
      .where(eq(classes.id, req.params.classId))
      .returning();
    if (!classItem) throw new AppError("academic.classNotFound", 404);

    if (disciplineIds)
      await replaceDisciplineLinksForClass(classItem.id, disciplineIds);

    return res.json({
      message: t("academic.classUpdated"),
      class: classItem,
      registrationCode: classItem.registrationCode,
    });
  }),
);

academicRouter.patch(
  "/classes/:classId/registration-code",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const [classItem] = await getDb()
      .select()
      .from(classes)
      .where(eq(classes.id, req.params.classId))
      .limit(1);
    if (!classItem) throw new AppError("academic.classNotFound", 404);
    await assertCanManageCourse(req, classItem.courseId);

    const registrationCode = await generateUniqueRegistrationCode(getDb());
    const [updatedClass] = await getDb()
      .update(classes)
      .set({ registrationCode, updatedAt: new Date() })
      .where(eq(classes.id, classItem.id))
      .returning();

    return res.json({
      message: t("academic.classCodeRegenerated"),
      class: updatedClass,
      registrationCode: updatedClass.registrationCode,
    });
  }),
);

academicRouter.get(
  "/courses/:courseId/classes",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    await assertCourseInNetwork(getDb(), req.user!, req.params.courseId);
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
    return res.json({ message: t("academic.classRemoved") });
  }),
);

async function replaceClassDisciplineLinks(
  classIds: string[],
  disciplineId: string,
) {
  const db = getDb();
  const existingLinks = await db
    .select()
    .from(classDisciplines)
    .where(eq(classDisciplines.disciplineId, disciplineId));
  for (const link of existingLinks) {
    if (!classIds.includes(link.classId)) {
      await db
        .delete(classDisciplines)
        .where(
          and(
            eq(classDisciplines.classId, link.classId),
            eq(classDisciplines.disciplineId, disciplineId),
          ),
        );
    }
  }
  if (classIds.length) await ensureClassDisciplineLinks(classIds, disciplineId);
}

async function replaceProfessorDisciplineLinks(
  professorIds: string[],
  disciplineId: string,
) {
  const db = getDb();
  const existingLinks = await db
    .select()
    .from(professorDisciplines)
    .where(eq(professorDisciplines.disciplineId, disciplineId));
  for (const link of existingLinks) {
    if (!professorIds.includes(link.professorId)) {
      await db
        .delete(professorDisciplines)
        .where(
          and(
            eq(professorDisciplines.professorId, link.professorId),
            eq(professorDisciplines.disciplineId, disciplineId),
          ),
        );
    }
  }
  if (professorIds.length) {
    await db
      .insert(professorDisciplines)
      .values(
        professorIds.map((professorId) => ({ professorId, disciplineId })),
      )
      .onConflictDoNothing();
  }
}

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
    if (!course) throw new AppError("academic.courseNotFound", 404);
    await assertCanManageCourse(req, courseId);
    if (classIds.length) {
      const classRows = await getDb()
        .select()
        .from(classes)
        .where(inArray(classes.id, classIds));
      if (
        classRows.length !== classIds.length ||
        classRows.some((item) => item.courseId !== courseId)
      ) {
        throw new AppError("academic.classesOutsideCourse",
          400,
        );
      }
    }
    if (professorIds.length) {
      const professorCourseRows = await getDb()
        .select()
        .from(professorCourses)
        .where(inArray(professorCourses.professorId, professorIds));
      const invalidProfessor = professorIds.some(
        (professorId) =>
          !professorCourseRows.some(
            (link) =>
              link.professorId === professorId && link.courseId === courseId,
          ),
      );
      if (invalidProfessor)
        throw new AppError("academic.professorsOutsideCourse",
          400,
        );
    }
    const [discipline] = await getDb()
      .insert(disciplines)
      .values({ name, courseId })
      .returning();
    if (classIds.length)
      await ensureClassDisciplineLinks(classIds, discipline.id);
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
    return res.status(201).json({
      message: t("academic.disciplineCreated"),
      discipline,
    });
  }),
);

academicRouter.patch(
  "/disciplines/:disciplineId",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const courseId = String(req.body.courseId || req.body.course || "");
    const classIds = Array.isArray(req.body.classIds)
      ? [...new Set(req.body.classIds as string[])]
      : undefined;
    const professorIds = Array.isArray(req.body.professorIds)
      ? [...new Set(req.body.professorIds as string[])]
      : undefined;
    if (!name || !courseId)
      throw new AppError("academic.nameCourseRequired", 400);

    const [course] = await getDb()
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!course) throw new AppError("academic.courseNotFound", 404);
    await assertCanManageCourse(req, courseId);

    if (classIds?.length) {
      const classRows = await getDb()
        .select()
        .from(classes)
        .where(inArray(classes.id, classIds));
      if (
        classRows.length !== classIds.length ||
        classRows.some((item) => item.courseId !== courseId)
      ) {
        throw new AppError("academic.classesOutsideCourse",
          400,
        );
      }
    }

    if (professorIds?.length) {
      const professorCourseRows = await getDb()
        .select()
        .from(professorCourses)
        .where(inArray(professorCourses.professorId, professorIds));
      const invalidProfessor = professorIds.some(
        (professorId) =>
          !professorCourseRows.some(
            (link) =>
              link.professorId === professorId && link.courseId === courseId,
          ),
      );
      if (invalidProfessor)
        throw new AppError("academic.professorsOutsideCourse",
          400,
        );
    }

    const [discipline] = await getDb()
      .update(disciplines)
      .set({ name, courseId, updatedAt: new Date() })
      .where(eq(disciplines.id, req.params.disciplineId))
      .returning();
    if (!discipline) throw new AppError("academic.disciplineNotFound", 404);

    if (classIds) await replaceClassDisciplineLinks(classIds, discipline.id);
    if (professorIds)
      await replaceProfessorDisciplineLinks(professorIds, discipline.id);

    return res.json({
      message: t("academic.disciplineUpdated"),
      discipline,
    });
  }),
);

academicRouter.post(
  "/disciplines/:disciplineId/professors",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const professorId = String(req.body.professorId || "");
    if (!professorId) throw new AppError("academic.professorIdRequired", 400);

    const [discipline] = await getDb()
      .select()
      .from(disciplines)
      .where(eq(disciplines.id, req.params.disciplineId))
      .limit(1);
    if (!discipline) throw new AppError("academic.disciplineNotFound", 404);
    await assertCanManageCourse(req, discipline.courseId);

    const [professorCourse] = await getDb()
      .select()
      .from(professorCourses)
      .where(
        and(
          eq(professorCourses.professorId, professorId),
          eq(professorCourses.courseId, discipline.courseId),
        ),
      )
      .limit(1);
    if (!professorCourse)
      throw new AppError("academic.professorOutsideCourse", 400);

    await getDb()
      .insert(professorDisciplines)
      .values({ professorId, disciplineId: discipline.id })
      .onConflictDoNothing();

    return res.json({
      message: t("academic.professorLinked"),
    });
  }),
);

academicRouter.post(
  "/classes/:classId/disciplines",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const disciplineId = String(req.body.disciplineId || "");
    if (!disciplineId) throw new AppError("academic.disciplineIdRequired", 400);

    const [[classItem], [discipline]] = await Promise.all([
      getDb()
        .select()
        .from(classes)
        .where(eq(classes.id, req.params.classId))
        .limit(1),
      getDb()
        .select()
        .from(disciplines)
        .where(eq(disciplines.id, disciplineId))
        .limit(1),
    ]);
    if (!classItem) throw new AppError("academic.classNotFound", 404);
    if (!discipline) throw new AppError("academic.disciplineNotFound", 404);
    if (classItem.courseId !== discipline.courseId)
      throw new AppError("academic.classDisciplineCourseMismatch",
        400,
      );
    await assertCanManageCourse(req, classItem.courseId);

    await ensureClassDisciplineLinks([classItem.id], discipline.id);
    return res.json({ message: t("academic.disciplineLinked") });
  }),
);

academicRouter.delete(
  "/classes/:classId/disciplines/:disciplineId",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const [classItem] = await getDb()
      .select()
      .from(classes)
      .where(eq(classes.id, req.params.classId))
      .limit(1);
    if (!classItem) throw new AppError("academic.classNotFound", 404);
    await assertCanManageCourse(req, classItem.courseId);

    await getDb()
      .delete(classDisciplines)
      .where(
        and(
          eq(classDisciplines.classId, req.params.classId),
          eq(classDisciplines.disciplineId, req.params.disciplineId),
        ),
      );

    return res.json({
      message: t("academic.disciplineUnlinked"),
    });
  }),
);

academicRouter.delete(
  "/disciplines/:disciplineId/professors/:professorId",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const [discipline] = await getDb()
      .select()
      .from(disciplines)
      .where(eq(disciplines.id, req.params.disciplineId))
      .limit(1);
    if (!discipline) throw new AppError("academic.disciplineNotFound", 404);
    await assertCanManageCourse(req, discipline.courseId);

    await getDb()
      .delete(professorDisciplines)
      .where(
        and(
          eq(professorDisciplines.professorId, req.params.professorId),
          eq(professorDisciplines.disciplineId, discipline.id),
        ),
      );

    return res.json({
      message: t("academic.professorUnlinked"),
    });
  }),
);

academicRouter.get(
  "/disciplines",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    if (seesEveryNetwork(req.user!))
      return res.json(await getDb().select().from(disciplines).orderBy(asc(disciplines.name)));
    // Coordinators only see the subjects of the courses they coordinate.
    const own = coordinatedCourses(req.user!) ?? [];
    if (!own.length) return res.json([]);
    const rows = await getDb()
      .select({ discipline: disciplines })
      .from(disciplines)
      .innerJoin(courses, eq(courses.id, disciplines.courseId))
      .where(and(eq(courses.universityId, requireNetwork(req.user!)), inArray(courses.id, own)))
      .orderBy(asc(disciplines.name));
    return res.json(rows.map((row) => row.discipline));
  }),
);

academicRouter.delete(
  "/disciplines/:disciplineId",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    await assertDisciplineInNetwork(getDb(), req.user!, req.params.disciplineId);
    await getDb()
      .delete(disciplines)
      .where(eq(disciplines.id, req.params.disciplineId));
    return res.json({ message: t("academic.disciplineRemoved") });
  }),
);

// ─── Student enrollment ───────────────────────────────────────────────────────

async function assertCanManageDisciplineStudents(
  req: Request,
  discipline: { id: string; courseId: string },
) {
  if (req.user!.role.includes("admin")) return;
  if (req.user!.role.includes("course-coordinator")) {
    await assertCanManageCourse(req, discipline.courseId);
    return;
  }
  if (req.user!.role.includes("professor")) {
    const [link] = await getDb()
      .select()
      .from(professorDisciplines)
      .where(
        and(
          eq(professorDisciplines.professorId, req.user!.id),
          eq(professorDisciplines.disciplineId, discipline.id),
        ),
      )
      .limit(1);
    if (!link)
      throw new AppError("academic.professorNotLinked", 403);
    return;
  }
  throw new AppError("auth.accessDenied", 403);
}

academicRouter.post(
  "/classes/:classId/students",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const studentId = String(req.body.studentId || "").trim();
    if (!studentId) throw new AppError("academic.studentIdRequired", 400);

    const [classItem] = await getDb()
      .select()
      .from(classes)
      .where(eq(classes.id, req.params.classId))
      .limit(1);
    if (!classItem) throw new AppError("academic.classNotFound", 404);
    await assertCanManageCourse(req, classItem.courseId);

    const [profile] = await getDb()
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.accountId, studentId))
      .limit(1);
    if (!profile) throw new AppError("academic.studentNotFound", 404);
    if (profile.courseId !== classItem.courseId)
      throw new AppError("academic.studentOutsideClassCourse", 400);

    await getDb()
      .update(studentProfiles)
      .set({ classId: req.params.classId })
      .where(eq(studentProfiles.accountId, studentId));
    return res.json({ message: t("academic.studentAdded") });
  }),
);

academicRouter.delete(
  "/classes/:classId/students/:studentId",
  requireRoles(["admin", "course-coordinator"]),
  asyncHandler(async (req, res) => {
    const [classItem] = await getDb()
      .select()
      .from(classes)
      .where(eq(classes.id, req.params.classId))
      .limit(1);
    if (!classItem) throw new AppError("academic.classNotFound", 404);
    await assertCanManageCourse(req, classItem.courseId);

    throw new AppError("academic.studentNeedsClass",
      400,
    );
  }),
);

academicRouter.post(
  "/disciplines/:disciplineId/students",
  requireRoles(["admin", "course-coordinator", "professor"]),
  asyncHandler(async (req, res) => {
    const studentId = String(req.body.studentId || "").trim();
    if (!studentId) throw new AppError("academic.studentIdRequired", 400);

    const [discipline] = await getDb()
      .select()
      .from(disciplines)
      .where(eq(disciplines.id, req.params.disciplineId))
      .limit(1);
    if (!discipline) throw new AppError("academic.disciplineNotFound", 404);
    await assertCanManageDisciplineStudents(req, discipline);

    const [profile] = await getDb()
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.accountId, studentId))
      .limit(1);
    if (!profile) throw new AppError("academic.studentNotFound", 404);
    if (profile.courseId !== discipline.courseId)
      throw new AppError("academic.studentOutsideDisciplineCourse", 400);

    throw new AppError("academic.studentClassManaged",
      400,
    );
  }),
);

academicRouter.delete(
  "/disciplines/:disciplineId/students/:studentId",
  requireRoles(["admin", "course-coordinator", "professor"]),
  asyncHandler(async (req, res) => {
    const [discipline] = await getDb()
      .select()
      .from(disciplines)
      .where(eq(disciplines.id, req.params.disciplineId))
      .limit(1);
    if (!discipline) throw new AppError("academic.disciplineNotFound", 404);
    await assertCanManageDisciplineStudents(req, discipline);

    throw new AppError("academic.studentRemovalClassManaged",
      400,
    );
  }),
);
