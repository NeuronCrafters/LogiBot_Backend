import { eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/client";
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
  studentProfiles,
  universities,
} from "../../db/schema";

type AcademicFiltersUser = {
  id: string;
  name: string;
  email: string;
  role: string[];
  school?: string | null;
  courses?: string[] | string | null;
};

export async function buildAcademicFilters(user: AcademicFiltersUser) {
  const db = getDb();
  const isAdmin = user.role.includes("admin");
  const userCourseIds = Array.isArray(user.courses)
    ? user.courses
    : typeof user.courses === "string"
      ? [user.courses]
      : [];
  const schoolId = user.school || undefined;

  const universityRows = isAdmin
    ? await db.select().from(universities)
    : schoolId
      ? await db.select().from(universities).where(eq(universities.id, schoolId))
      : [];
  const universityIds = universityRows.map((item) => item.id);
  const allCourseRows = universityIds.length
    ? await db.select().from(courses).where(inArray(courses.universityId, universityIds))
    : [];
  const courseRows = isAdmin || !userCourseIds.length
    ? allCourseRows
    : allCourseRows.filter((course) => userCourseIds.includes(course.id));
  const courseIds = courseRows.map((item) => item.id);
  const classRows = courseIds.length
    ? await db.select().from(classes).where(inArray(classes.courseId, courseIds))
    : [];
  const disciplineRows = courseIds.length
    ? await db.select().from(disciplines).where(inArray(disciplines.courseId, courseIds))
    : [];
  const professorRows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      email: accounts.email,
      photo: accounts.photo,
      schoolId: professorProfiles.schoolId,
    })
    .from(accounts)
    .innerJoin(professorProfiles, eq(professorProfiles.accountId, accounts.id));
  const studentRows = courseIds.length
    ? await db
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
        .where(inArray(studentProfiles.courseId, courseIds))
    : [];
  const [classLinks, professorCourseLinks, professorDisciplineLinks, roleRows] = await Promise.all([
    disciplineRows.length
      ? db
          .select()
          .from(classDisciplines)
          .where(inArray(classDisciplines.disciplineId, disciplineRows.map((item) => item.id)))
      : [],
    professorRows.length
      ? db
          .select()
          .from(professorCourses)
          .where(inArray(professorCourses.professorId, professorRows.map((item) => item.id)))
      : [],
    professorRows.length
      ? db
          .select()
          .from(professorDisciplines)
          .where(inArray(professorDisciplines.professorId, professorRows.map((item) => item.id)))
      : [],
    professorRows.length
      ? db
          .select()
          .from(accountRoles)
          .where(inArray(accountRoles.accountId, professorRows.map((item) => item.id)))
      : [],
  ]);

  const data = universityRows.map((university) => ({
    _id: university.id,
    id: university.id,
    name: university.name,
    courses: courseRows
      .filter((course) => course.universityId === university.id)
      .map((course) => ({
        _id: course.id,
        id: course.id,
        name: course.name,
        classes: classRows
          .filter((classItem) => classItem.courseId === course.id)
          .map((classItem) => ({
            _id: classItem.id,
            id: classItem.id,
            name: classItem.name,
            registrationCode: classItem.registrationCode,
            disciplines: classLinks
              .filter((link) => link.classId === classItem.id)
              .flatMap((link) =>
                disciplineRows
                  .filter((discipline) => discipline.id === link.disciplineId)
                  .map((discipline) => ({
                    _id: discipline.id,
                    id: discipline.id,
                    name: discipline.name,
                  })),
              ),
            students: studentRows
              .filter((student) => student.classId === classItem.id)
              .map((student) => ({
                _id: student.id,
                id: student.id,
                name: student.name,
                email: student.email,
                status: student.status,
                photo: student.photo,
                level: student.level,
              })),
          })),
        disciplines: disciplineRows
          .filter((discipline) => discipline.courseId === course.id)
          .map((discipline) => ({
            _id: discipline.id,
            id: discipline.id,
            name: discipline.name,
            classes: classLinks
              .filter((link) => link.disciplineId === discipline.id)
              .flatMap((link) =>
                classRows
                  .filter((classItem) => classItem.id === link.classId)
                  .map((classItem) => ({
                    _id: classItem.id,
                    id: classItem.id,
                    name: classItem.name,
                    registrationCode: classItem.registrationCode,
                  })),
              ),
            professors: professorDisciplineLinks
              .filter((link) => link.disciplineId === discipline.id)
              .flatMap((link) =>
                professorRows
                  .filter((professor) => professor.id === link.professorId)
                  .map((professor) => ({
                    _id: professor.id,
                    id: professor.id,
                    name: professor.name,
                    email: professor.email,
                    photo: professor.photo,
                    role: roleRows
                      .filter((role) => role.accountId === professor.id)
                      .map((role) => role.role),
                  })),
              ),
            students: studentRows
              .filter((student) =>
                classLinks.some((link) => link.disciplineId === discipline.id && link.classId === student.classId),
              )
              .map((student) => ({
                _id: student.id,
                id: student.id,
                name: student.name,
                email: student.email,
                status: student.status,
                photo: student.photo,
              })),
          })),
        professors: professorCourseLinks
          .filter((link) => link.courseId === course.id)
          .flatMap((link) =>
            professorRows
              .filter((professor) => professor.id === link.professorId)
              .map((professor) => ({
                _id: professor.id,
                id: professor.id,
                name: professor.name,
                email: professor.email,
                photo: professor.photo,
                role: roleRows
                  .filter((role) => role.accountId === professor.id)
                  .map((role) => role.role),
              })),
          ),
        students: studentRows
          .filter((student) => student.courseId === course.id)
          .map((student) => ({
            _id: student.id,
            id: student.id,
            name: student.name,
            email: student.email,
            status: student.status,
            photo: student.photo,
            level: student.level,
          })),
      })),
  }));

  return {
    success: true,
    data: { universities: data },
    summary: {
      universities: data.length,
      courses: courseRows.length,
      classes: classRows.length,
      disciplines: disciplineRows.length,
      professors: professorRows.length,
      students: studentRows.length,
    },
    user: {
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    meta: { timestamp: new Date().toISOString(), version: "node" },
  };
}
