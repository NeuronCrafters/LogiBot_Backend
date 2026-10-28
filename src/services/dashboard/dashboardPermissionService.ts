import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  classDisciplines,
  classes,
  disciplines,
  studentProfiles,
} from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import type { Filters } from "../analytics/analyticsService";

type DashboardUser = NonNullable<Express.Request["user"]>;

function values(input?: string[] | string | null) {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

export async function assertDashboardScopeAccess(
  user: DashboardUser,
  filters: Filters,
) {
  if (user.role.includes("admin")) return;

  if (filters.universityId && filters.universityId !== user.school) {
    throw new AppError("dashboard.universityDenied", 403);
  }
  if (
    !filters.courseId &&
    !filters.classId &&
    !filters.disciplineId &&
    !filters.studentId
  ) {
    throw new AppError("dashboard.scopeRequired",
      403,
    );
  }

  const allowedCourseIds = new Set(values(user.courses));
  const allowedClassIds = new Set(values(user.classes));
  const allowedDisciplineIds = new Set(user.disciplines ?? []);
  const isProfessorOnly =
    user.role.includes("professor") &&
    !user.role.includes("course-coordinator");

  if (filters.courseId && !allowedCourseIds.has(filters.courseId)) {
    throw new AppError("dashboard.courseDenied", 403);
  }

  if (filters.classId) {
    const [classItem] = await getDb()
      .select({ id: classes.id, courseId: classes.courseId })
      .from(classes)
      .where(eq(classes.id, filters.classId))
      .limit(1);
    if (!classItem || !allowedCourseIds.has(classItem.courseId)) {
      throw new AppError("rag.classAccessDenied", 403);
    }

    if (isProfessorOnly && !allowedClassIds.has(classItem.id)) {
      const links = allowedDisciplineIds.size
        ? await getDb()
            .select({ disciplineId: classDisciplines.disciplineId })
            .from(classDisciplines)
            .where(
              and(
                eq(classDisciplines.classId, classItem.id),
                inArray(
                  classDisciplines.disciplineId,
                  [...allowedDisciplineIds],
                ),
              ),
            )
        : [];
      if (!links.length)
        throw new AppError("rag.classAccessDenied", 403);
    }
  }

  if (filters.disciplineId) {
    const [discipline] = await getDb()
      .select({ id: disciplines.id, courseId: disciplines.courseId })
      .from(disciplines)
      .where(eq(disciplines.id, filters.disciplineId))
      .limit(1);
    if (!discipline || !allowedCourseIds.has(discipline.courseId)) {
      throw new AppError("dashboard.disciplineDenied", 403);
    }
    if (
      isProfessorOnly &&
      !allowedDisciplineIds.has(discipline.id)
    ) {
      throw new AppError("dashboard.disciplineDenied", 403);
    }
  }

  if (filters.studentId) {
    const [profile] = await getDb()
      .select({
        schoolId: studentProfiles.schoolId,
        courseId: studentProfiles.courseId,
        classId: studentProfiles.classId,
      })
      .from(studentProfiles)
      .where(eq(studentProfiles.accountId, filters.studentId))
      .limit(1);
    if (
      !profile ||
      profile.schoolId !== user.school ||
      !allowedCourseIds.has(profile.courseId)
    ) {
      throw new AppError("dashboard.studentDenied", 403);
    }

    if (isProfessorOnly) {
      const directlyAllowed = allowedClassIds.has(profile.classId);
      const disciplineAllowed =
        allowedDisciplineIds.size > 0
          ? await getDb()
              .select({ disciplineId: classDisciplines.disciplineId })
              .from(classDisciplines)
              .where(
                and(
                  eq(classDisciplines.classId, profile.classId),
                  inArray(
                    classDisciplines.disciplineId,
                    [...allowedDisciplineIds],
                  ),
                ),
              )
          : [];
      if (!directlyAllowed && !disciplineAllowed.length) {
        throw new AppError("dashboard.studentDenied", 403);
      }
    }
  }
}
