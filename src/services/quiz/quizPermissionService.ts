import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  classDisciplines,
  professorClasses,
  professorCourses,
  professorDisciplines,
} from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { assertCanManageRagClass } from "../rag/ragPermissionService";

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

export function canManageQuiz(
  quiz: { professorId: string; disciplineId: string },
  user: QuizUser,
): boolean {
  if (user.role.includes("admin")) return true;
  if (quiz.professorId === user.id) return true;
  if (
    user.role.includes("course-coordinator") &&
    (user.disciplines ?? []).includes(quiz.disciplineId)
  )
    return true;
  return false;
}
