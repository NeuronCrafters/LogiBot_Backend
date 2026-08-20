import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  classDisciplines,
  courses,
  disciplines,
  professorClasses,
  professorCourses,
  professorDisciplines,
  professorQuizDisciplines,
} from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { assertCanManageRagClass } from "../rag/ragPermissionService";
import { toArray } from "../rag/ragTypes";

type QuizUser = NonNullable<import("express").Request["user"]>;

export async function assertCanManageQuizClass(
  user: QuizUser,
  classId: string,
): Promise<void> {
  await assertCanManageRagClass(
    {
      id: user.id,
      role: user.role,
      courses: user.courses,
      classes: user.classes,
      disciplines: user.disciplines,
    },
    classId,
  );
}

export async function assertDisciplineBelongsToClass(
  disciplineId: string,
  classId: string,
): Promise<void> {
  const [link] = await getDb()
    .select({ disciplineId: classDisciplines.disciplineId })
    .from(classDisciplines)
    .where(
      and(
        eq(classDisciplines.classId, classId),
        eq(classDisciplines.disciplineId, disciplineId),
      ),
    )
    .limit(1);

  if (!link)
    throw new AppError(
      "Disciplina não pertence à turma selecionada",
      400,
    );
}

export async function assertProfessorCanManageDiscipline(
  user: QuizUser,
  disciplineId: string,
): Promise<void> {
  if (user.role.includes("admin")) return;

  if (user.role.includes("course-coordinator")) {
    const coordDisciplines = user.disciplines ?? [];
    if (coordDisciplines.includes(disciplineId)) return;

    const [link] = await getDb()
      .select({ disciplineId: professorDisciplines.disciplineId })
      .from(professorDisciplines)
      .where(
        and(
          eq(professorDisciplines.professorId, user.id),
          eq(professorDisciplines.disciplineId, disciplineId),
        ),
      )
      .limit(1);
    if (link) return;

    throw new AppError(
      "Coordenador não tem acesso a esta disciplina",
      403,
    );
  }

  if (user.role.includes("professor")) {
    const [link] = await getDb()
      .select({ disciplineId: professorDisciplines.disciplineId })
      .from(professorDisciplines)
      .where(
        and(
          eq(professorDisciplines.professorId, user.id),
          eq(professorDisciplines.disciplineId, disciplineId),
        ),
      )
      .limit(1);
    if (link) return;

    throw new AppError(
      "Professor não tem acesso a esta disciplina",
      403,
    );
  }

  throw new AppError("Acesso negado", 403);
}

// Um quiz pode estar vinculado a varias disciplinas (professor_quiz_disciplines)
// — o coordenador pode gerenciar se alguma delas estiver no escopo dele.
// Mantem exatamente a mesma logica de antes (dono/admin/coordenador com claim
// ou vinculo em professor_disciplines), so trocando "a disciplina do quiz"
// por "qualquer disciplina vinculada ao quiz".
export async function canManageQuiz(
  quiz: { id: string; professorId: string; disciplineId: string },
  user: QuizUser,
): Promise<boolean> {
  if (user.role.includes("admin")) return true;
  if (quiz.professorId === user.id) return true;

  if (user.role.includes("course-coordinator")) {
    const linkedRows = await getDb()
      .select({ disciplineId: professorQuizDisciplines.disciplineId })
      .from(professorQuizDisciplines)
      .where(eq(professorQuizDisciplines.quizId, quiz.id));

    const disciplineIds = linkedRows.length
      ? linkedRows.map((row) => row.disciplineId)
      : [quiz.disciplineId];

    const coordDisciplines = user.disciplines ?? [];
    if (disciplineIds.some((id) => coordDisciplines.includes(id))) return true;

    const [link] = await getDb()
      .select({ disciplineId: professorDisciplines.disciplineId })
      .from(professorDisciplines)
      .where(
        and(
          eq(professorDisciplines.professorId, user.id),
          inArray(professorDisciplines.disciplineId, disciplineIds),
        ),
      )
      .limit(1);
    if (link) return true;
  }

  return false;
}

export type ManageableDiscipline = {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
};

// Mesma logica de listManageableRagClasses (ragPermissionService.ts), so pra
// disciplinas em vez de turmas.
export async function listManageableDisciplines(
  user: QuizUser,
): Promise<ManageableDiscipline[]> {
  const db = getDb();

  const baseSelect = {
    id: disciplines.id,
    name: disciplines.name,
    courseId: disciplines.courseId,
    courseName: courses.name,
  };

  if (user.role.includes("admin")) {
    return db
      .select(baseSelect)
      .from(disciplines)
      .innerJoin(courses, eq(courses.id, disciplines.courseId))
      .orderBy(asc(courses.name), asc(disciplines.name));
  }

  const disciplineIds = new Set<string>();

  if (user.role.includes("course-coordinator")) {
    const tokenCourseIds = toArray(user.courses);
    const courseRows = await db
      .select({ courseId: professorCourses.courseId })
      .from(professorCourses)
      .where(eq(professorCourses.professorId, user.id));
    const courseIds = [
      ...new Set([...tokenCourseIds, ...courseRows.map((row) => row.courseId)]),
    ];

    if (courseIds.length) {
      const disciplineRows = await db
        .select({ id: disciplines.id })
        .from(disciplines)
        .where(inArray(disciplines.courseId, courseIds));
      disciplineRows.forEach((row) => disciplineIds.add(row.id));
    }
  }

  if (user.role.includes("professor")) {
    const rows = await db
      .select({ disciplineId: professorDisciplines.disciplineId })
      .from(professorDisciplines)
      .where(eq(professorDisciplines.professorId, user.id));
    rows.forEach((row) => disciplineIds.add(row.disciplineId));
  }

  if (!disciplineIds.size) return [];

  return db
    .select(baseSelect)
    .from(disciplines)
    .innerJoin(courses, eq(courses.id, disciplines.courseId))
    .where(inArray(disciplines.id, [...disciplineIds]))
    .orderBy(asc(courses.name), asc(disciplines.name));
}
