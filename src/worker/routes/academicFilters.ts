import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import {
  accountRoles,
  accounts,
  classes,
  classDisciplines,
  courses,
  disciplines,
  professorCourses,
  professorDisciplines,
  professorProfiles,
  studentDisciplines,
  studentProfiles,
  universities,
} from "../../db/schema";
import { getDb } from "../db/client";
import { requireAuth, requireRoles } from "../http/auth";
import type { AppBindings } from "../types";

export const academicFiltersRoutes = new Hono<AppBindings>();

academicFiltersRoutes.use("/academicFilters/*", requireAuth);

academicFiltersRoutes.get(
  "/academicFilters/data",
  requireRoles(["admin", "professor", "course-coordinator"]),
  async (c) => {
    const user = c.get("user")!;
    const db = getDb(c.env);

    const isAdmin = user.role.includes("admin");
    const isCoordinator = user.role.includes("course-coordinator");
    const isProfessor = user.role.includes("professor");
    const schoolId = user.school ?? null;

    // For professors/coordinators, get their course and discipline associations
    let professorCourseIds: string[] = Array.isArray(user.courses)
      ? (user.courses as string[])
      : [];
    let professorDisciplineIds: string[] = [];

    if ((isCoordinator || isProfessor) && !isAdmin) {
      const disciplineRows = await db
        .select({ id: professorDisciplines.disciplineId })
        .from(professorDisciplines)
        .where(eq(professorDisciplines.professorId, user.id));
      professorDisciplineIds = disciplineRows.map((r) => r.id);
    }

    // Fetch universities
    const universityRows = isAdmin
      ? await db.select().from(universities)
      : schoolId
        ? await db.select().from(universities).where(eq(universities.id, schoolId))
        : [];

    if (universityRows.length === 0) {
      return c.json(buildResponse(user, [], {}));
    }

    const universityIds = universityRows.map((u) => u.id);

    // Fetch courses
    const courseRows =
      isAdmin
        ? await db.select().from(courses).where(inArray(courses.universityId, universityIds))
        : professorCourseIds.length
          ? await db.select().from(courses).where(
              and(
                inArray(courses.universityId, universityIds),
                inArray(courses.id, professorCourseIds),
              ),
            )
          : [];

    const courseIds = courseRows.map((r) => r.id);
    if (courseIds.length === 0) {
      return c.json(buildResponse(user, universityRows.map((u) => ({ ...u, courses: [] })), {}));
    }

    // Fetch classes
    const classRows = await db.select().from(classes).where(inArray(classes.courseId, courseIds));
    const classIds = classRows.map((r) => r.id);

    // Fetch disciplines (filtered for non-admin professors)
    const disciplineRows =
      isAdmin || isCoordinator
        ? await db.select().from(disciplines).where(inArray(disciplines.courseId, courseIds))
        : professorDisciplineIds.length
          ? await db.select().from(disciplines).where(
              and(
                inArray(disciplines.courseId, courseIds),
                inArray(disciplines.id, professorDisciplineIds),
              ),
            )
          : [];

    const disciplineIds = disciplineRows.map((r) => r.id);

    // Fetch class-discipline links
    const classDisciplineLinks =
      classIds.length && disciplineIds.length
        ? await db
            .select()
            .from(classDisciplines)
            .where(
              and(
                inArray(classDisciplines.classId, classIds),
                inArray(classDisciplines.disciplineId, disciplineIds),
              ),
            )
        : [];

    // Fetch professor accounts with profiles (scoped to school for non-admin)
    const professorAccountRows = isAdmin
      ? await db
          .select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo, schoolId: professorProfiles.schoolId })
          .from(accounts)
          .innerJoin(professorProfiles, eq(professorProfiles.accountId, accounts.id))
      : schoolId
        ? await db
            .select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo, schoolId: professorProfiles.schoolId })
            .from(accounts)
            .innerJoin(professorProfiles, eq(professorProfiles.accountId, accounts.id))
            .where(eq(professorProfiles.schoolId, schoolId))
        : [];

    const professorIds = professorAccountRows.map((p) => p.id);

    const [profCourseLinks, profDisciplineLinks, profRoleRows] = professorIds.length
      ? await Promise.all([
          db.select().from(professorCourses).where(inArray(professorCourses.professorId, professorIds)),
          db.select().from(professorDisciplines).where(inArray(professorDisciplines.professorId, professorIds)),
          db.select().from(accountRoles).where(inArray(accountRoles.accountId, professorIds)),
        ])
      : [[], [], []];

    // Fetch student accounts with profiles scoped to the relevant courses
    const studentAccountRows = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        email: accounts.email,
        photo: accounts.photo,
        status: accounts.status,
        classId: studentProfiles.classId,
        courseId: studentProfiles.courseId,
        level: studentProfiles.level,
      })
      .from(accounts)
      .innerJoin(studentProfiles, eq(studentProfiles.accountId, accounts.id))
      .where(inArray(studentProfiles.courseId, courseIds));

    const studentIds = studentAccountRows.map((s) => s.id);

    const studentDisciplineLinks =
      studentIds.length && disciplineIds.length
        ? await db
            .select()
            .from(studentDisciplines)
            .where(
              and(
                inArray(studentDisciplines.studentId, studentIds),
                inArray(studentDisciplines.disciplineId, disciplineIds),
              ),
            )
        : [];

    // Build lookup maps
    const classMap = new Map(classRows.map((r) => [r.id, r]));
    const disciplineMap = new Map(disciplineRows.map((r) => [r.id, r]));
    const studentMap = new Map(studentAccountRows.map((r) => [r.id, r]));
    const professorMap = new Map(professorAccountRows.map((r) => [r.id, r]));

    const coursesByUniversity = groupBy(courseRows, (r) => r.universityId);
    const classesByCourse = groupBy(classRows, (r) => r.courseId);
    const disciplinesByCourse = groupBy(disciplineRows, (r) => r.courseId);
    const disciplinesByClass = groupBy(classDisciplineLinks, (r) => r.classId);
    const profCourseMap = groupBy(profCourseLinks, (r) => r.courseId);
    const profDisciplineByProf = groupBy(profDisciplineLinks, (r) => r.professorId);
    const profDisciplineByDisc = groupBy(profDisciplineLinks, (r) => r.disciplineId);
    const profRoleByAccount = groupBy(profRoleRows, (r) => r.accountId);
    const studentsByCourse = groupBy(studentAccountRows, (r) => r.courseId);
    const studentsByClass = groupBy(studentAccountRows, (r) => r.classId);
    const studentDiscByDisc = groupBy(studentDisciplineLinks, (r) => r.disciplineId);
    const studentDiscByStudent = groupBy(studentDisciplineLinks, (r) => r.studentId);

    const universityData = universityRows.map((university) => ({
      _id: university.id,
      name: university.name,
      courses: (coursesByUniversity.get(university.id) || []).map((course) => {
        const courseClasses = classesByCourse.get(course.id) || [];
        const courseDisciplines = disciplinesByCourse.get(course.id) || [];
        const courseProfIds = (profCourseMap.get(course.id) || []).map((l) => l.professorId);
        const courseStudents = studentsByCourse.get(course.id) || [];

        return {
          _id: course.id,
          name: course.name,
          classes: courseClasses.map((cls) => {
            const clsDisciplineIds = (disciplinesByClass.get(cls.id) || []).map((l) => l.disciplineId);
            return {
              _id: cls.id,
              name: cls.name,
              disciplines: clsDisciplineIds.flatMap((dId) => {
                const d = disciplineMap.get(dId);
                return d ? [{ _id: d.id, name: d.name, code: d.code }] : [];
              }),
              students: (studentsByClass.get(cls.id) || []).map((s) => ({
                _id: s.id,
                name: s.name,
                email: s.email,
                status: s.status,
                photo: s.photo,
                level: s.level,
              })),
            };
          }),
          disciplines: courseDisciplines.map((disc) => {
            const discProfIds = (profDisciplineByDisc.get(disc.id) || []).map((l) => l.professorId);
            const discStudentIds = (studentDiscByDisc.get(disc.id) || []).map((l) => l.studentId);
            const discClassIds = classDisciplineLinks.filter((l) => l.disciplineId === disc.id).map((l) => l.classId);

            return {
              _id: disc.id,
              name: disc.name,
              code: disc.code,
              classes: discClassIds.flatMap((cId) => {
                const cls = classMap.get(cId);
                return cls ? [{ _id: cls.id, name: cls.name }] : [];
              }),
              professors: isCoordinator || isAdmin
                ? discProfIds.flatMap((pId) => {
                    const prof = professorMap.get(pId);
                    return prof
                      ? [{ _id: prof.id, name: prof.name, email: prof.email, role: (profRoleByAccount.get(pId) || []).map((r) => r.role), photo: prof.photo }]
                      : [];
                  })
                : [],
              students: discStudentIds.flatMap((sId) => {
                const s = studentMap.get(sId);
                if (!s) return [];
                const cls = classMap.get(s.classId);
                return [{ _id: s.id, name: s.name, email: s.email, status: s.status, photo: s.photo, level: s.level, class: cls ? { _id: cls.id, name: cls.name } : null }];
              }),
            };
          }),
          professors: (isCoordinator || isAdmin)
            ? courseProfIds.flatMap((pId) => {
                const prof = professorMap.get(pId);
                if (!prof) return [];
                const profDiscs = (profDisciplineByProf.get(pId) || []).flatMap((l) => {
                  const d = disciplineMap.get(l.disciplineId);
                  return d ? [{ _id: d.id, name: d.name, code: d.code }] : [];
                });
                return [{ _id: prof.id, name: prof.name, email: prof.email, role: (profRoleByAccount.get(pId) || []).map((r) => r.role), photo: prof.photo, disciplines: profDiscs }];
              })
            : [],
          students: courseStudents.map((s) => {
            const cls = classMap.get(s.classId);
            const stuDiscs = (studentDiscByStudent.get(s.id) || []).flatMap((l) => {
              const d = disciplineMap.get(l.disciplineId);
              return d ? [{ _id: d.id, name: d.name, code: d.code }] : [];
            });
            return { _id: s.id, name: s.name, email: s.email, status: s.status, photo: s.photo, level: s.level, class: cls ? { _id: cls.id, name: cls.name } : null, disciplines: stuDiscs };
          }),
        };
      }),
    }));

    return c.json(buildResponse(user, universityData, calculateSummary(universityData as UniversityData[])));
  },
);

function groupBy<T>(arr: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const k = key(item);
    const existing = map.get(k);
    if (existing) existing.push(item);
    else map.set(k, [item]);
  }
  return map;
}

type UniversityData = {
  _id: string;
  name: string;
  courses: { _id: string; name: string; classes: unknown[]; disciplines: unknown[]; professors: unknown[]; students: unknown[] }[];
};

function calculateSummary(universities: UniversityData[]) {
  const summary = { universities: 0, courses: 0, classes: 0, disciplines: 0, professors: 0, students: 0 };
  for (const u of universities) {
    summary.universities++;
    for (const course of u.courses) {
      summary.courses++;
      summary.classes += (course.classes as unknown[]).length;
      summary.disciplines += (course.disciplines as unknown[]).length;
      summary.professors += (course.professors as unknown[]).length;
      summary.students += (course.students as unknown[]).length;
    }
  }
  return summary;
}

function buildResponse(user: { id: string; name: string; email: string; role: string[]; school?: string | null }, data: unknown[], summary: Record<string, number>) {
  const isAdmin = user.role.includes("admin");
  const isCoordinator = user.role.includes("course-coordinator");
  const isProfessor = user.role.includes("professor");

  return {
    success: true,
    data: { universities: data },
    summary,
    user: {
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: {
        canViewAllUniversities: isAdmin,
        canViewAllCourses: isAdmin,
        canViewOwnCourse: isCoordinator || isProfessor,
        canViewClasses: isAdmin || isCoordinator || isProfessor,
        canViewDisciplines: isAdmin || isCoordinator || isProfessor,
        canViewStudents: isAdmin || isCoordinator || isProfessor,
        canViewProfessors: isAdmin || isCoordinator,
        canViewAnalytics: isAdmin || isCoordinator,
      },
      accessLevel: isAdmin ? "ADMIN" : isCoordinator ? "COORDINATOR" : "PROFESSOR",
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: "2.0",
      source: "academic-data-service",
    },
  };
}
