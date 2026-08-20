import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  classDisciplines,
  classes,
  courses,
  professorClasses,
  professorCourses,
  professorDisciplines,
  ragDocumentClasses,
} from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import type { RagUser } from "./ragTypes";
import { toArray } from "./ragTypes";

export type ManageableRagClass = {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  registrationCode: string;
};

function isAdmin(user: RagUser) {
  return user.role.includes("admin");
}

function isCoordinator(user: RagUser) {
  return user.role.includes("course-coordinator");
}

function isProfessor(user: RagUser) {
  return user.role.includes("professor");
}

async function getClassOrThrow(classId: string) {
  const [classItem] = await getDb()
    .select()
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (!classItem) throw new AppError("turma nao encontrada", 404);
  return classItem;
}

export async function assertCanManageRagClass(
  user: RagUser,
  classId: string,
) {
  const classItem = await getClassOrThrow(classId);
  if (isAdmin(user)) return classItem;

  const db = getDb();

  if (isCoordinator(user)) {
    const tokenCourseIds = toArray(user.courses);
    const [courseLink] = await db
      .select({ courseId: professorCourses.courseId })
      .from(professorCourses)
      .where(
        and(
          eq(professorCourses.professorId, user.id),
          eq(professorCourses.courseId, classItem.courseId),
        ),
      )
      .limit(1);

    if (courseLink || tokenCourseIds.includes(classItem.courseId))
      return classItem;
  }

  if (isProfessor(user)) {
    const [directClassLink] = await db
      .select({ classId: professorClasses.classId })
      .from(professorClasses)
      .where(
        and(
          eq(professorClasses.professorId, user.id),
          eq(professorClasses.classId, classId),
        ),
      )
      .limit(1);

    if (directClassLink) return classItem;

    const [disciplineClassLink] = await db
      .select({ classId: classDisciplines.classId })
      .from(classDisciplines)
      .innerJoin(
        professorDisciplines,
        eq(professorDisciplines.disciplineId, classDisciplines.disciplineId),
      )
      .where(
        and(
          eq(professorDisciplines.professorId, user.id),
          eq(classDisciplines.classId, classId),
        ),
      )
      .limit(1);

    if (disciplineClassLink) return classItem;
  }

  throw new AppError("acesso negado para esta turma", 403);
}

export async function listManageableRagClasses(
  user: RagUser,
): Promise<ManageableRagClass[]> {
  const db = getDb();

  const baseSelect = {
    id: classes.id,
    name: classes.name,
    courseId: classes.courseId,
    courseName: courses.name,
    registrationCode: classes.registrationCode,
  };

  if (isAdmin(user)) {
    return db
      .select(baseSelect)
      .from(classes)
      .innerJoin(courses, eq(courses.id, classes.courseId))
      .orderBy(asc(courses.name), asc(classes.name));
  }

  const classIds = new Set<string>();

  if (isCoordinator(user)) {
    const tokenCourseIds = toArray(user.courses);
    const courseRows = await db
      .select({ courseId: professorCourses.courseId })
      .from(professorCourses)
      .where(eq(professorCourses.professorId, user.id));
    const courseIds = [
      ...new Set([...tokenCourseIds, ...courseRows.map((row) => row.courseId)]),
    ];

    if (courseIds.length) {
      const classRows = await db
        .select({ classId: classes.id })
        .from(classes)
        .where(inArray(classes.courseId, courseIds));
      classRows.forEach((row) => classIds.add(row.classId));
    }
  }

  if (isProfessor(user)) {
    const directClassRows = await db
      .select({ classId: professorClasses.classId })
      .from(professorClasses)
      .where(eq(professorClasses.professorId, user.id));
    directClassRows.forEach((row) => classIds.add(row.classId));

    const disciplineClassRows = await db
      .select({ classId: classDisciplines.classId })
      .from(classDisciplines)
      .innerJoin(
        professorDisciplines,
        eq(professorDisciplines.disciplineId, classDisciplines.disciplineId),
      )
      .where(eq(professorDisciplines.professorId, user.id));
    disciplineClassRows.forEach((row) => classIds.add(row.classId));
  }

  if (!classIds.size) return [];

  return db
    .select(baseSelect)
    .from(classes)
    .innerJoin(courses, eq(courses.id, classes.courseId))
    .where(inArray(classes.id, [...classIds]))
    .orderBy(asc(courses.name), asc(classes.name));
}

// Um documento pode estar vinculado a varias turmas (rag_document_classes) —
// o usuario pode gerenciar o documento se gerenciar ao menos uma delas.
export async function assertCanManageRagDocument(
  user: RagUser,
  documentId: string,
) {
  if (isAdmin(user)) return;

  const linkedClassIds = await getDb()
    .select({ classId: ragDocumentClasses.classId })
    .from(ragDocumentClasses)
    .where(eq(ragDocumentClasses.documentId, documentId));

  if (!linkedClassIds.length)
    throw new AppError("documento nao encontrado", 404);

  const manageableClassIds = new Set(
    (await listManageableRagClasses(user)).map((c) => c.id),
  );

  const hasAccess = linkedClassIds.some((row) =>
    manageableClassIds.has(row.classId),
  );

  if (!hasAccess) throw new AppError("acesso negado para este documento", 403);
}
