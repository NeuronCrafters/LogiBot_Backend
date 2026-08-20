import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { professorQuizDisciplines, professorQuizzes } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import {
  assertProfessorCanManageDiscipline,
  canManageQuiz,
} from "./quizPermissionService";

type QuizUser = NonNullable<import("express").Request["user"]>;

async function getQuizOrThrow(quizId: string) {
  const [quiz] = await getDb()
    .select()
    .from(professorQuizzes)
    .where(eq(professorQuizzes.id, quizId))
    .limit(1);

  if (!quiz) throw new AppError("Quiz não encontrado", 404);
  return quiz;
}

export async function listLinkedDisciplines(user: QuizUser, quizId: string) {
  const quiz = await getQuizOrThrow(quizId);
  if (!(await canManageQuiz(quiz, user))) throw new AppError("Acesso negado", 403);

  const rows = await getDb()
    .select({ disciplineId: professorQuizDisciplines.disciplineId })
    .from(professorQuizDisciplines)
    .where(eq(professorQuizDisciplines.quizId, quizId));

  return rows.map((row) => row.disciplineId);
}

// Vincula um quiz ja existente a mais disciplinas, sem duplicar perguntas.
export async function linkQuizToDisciplines(
  user: QuizUser,
  quizId: string,
  disciplineIds: string[],
) {
  const quiz = await getQuizOrThrow(quizId);
  if (!(await canManageQuiz(quiz, user))) throw new AppError("Acesso negado", 403);

  const uniqueIds = [...new Set(disciplineIds)].filter(Boolean);
  if (!uniqueIds.length)
    throw new AppError("selecione ao menos uma disciplina", 400);

  const linkedDisciplineIds: string[] = [];
  for (const disciplineId of uniqueIds) {
    await assertProfessorCanManageDiscipline(user, disciplineId);

    const [row] = await getDb()
      .insert(professorQuizDisciplines)
      .values({ quizId, disciplineId })
      .onConflictDoNothing()
      .returning();

    if (row) linkedDisciplineIds.push(disciplineId);
  }

  return { quiz, linkedDisciplineIds };
}

// Remove o vinculo do quiz com uma disciplina. Nunca deixa o quiz sem
// nenhuma disciplina — bloqueia se for a ultima restante. Se a disciplina
// removida era a "dona" (professor_quizzes.discipline_id), reatribui pra
// uma das que restaram, pra esse campo nunca ficar apontando pra um vinculo
// que nao existe mais.
export async function unlinkQuizFromDiscipline(
  user: QuizUser,
  quizId: string,
  disciplineId: string,
) {
  const quiz = await getQuizOrThrow(quizId);
  if (!(await canManageQuiz(quiz, user))) throw new AppError("Acesso negado", 403);

  const linkedRows = await getDb()
    .select({ disciplineId: professorQuizDisciplines.disciplineId })
    .from(professorQuizDisciplines)
    .where(eq(professorQuizDisciplines.quizId, quizId));

  if (linkedRows.length <= 1) {
    throw new AppError("um quiz precisa de pelo menos uma matéria", 400);
  }

  await getDb()
    .delete(professorQuizDisciplines)
    .where(
      and(
        eq(professorQuizDisciplines.quizId, quizId),
        eq(professorQuizDisciplines.disciplineId, disciplineId),
      ),
    );

  if (quiz.disciplineId === disciplineId) {
    const remaining = linkedRows.find((row) => row.disciplineId !== disciplineId);
    if (remaining) {
      await getDb()
        .update(professorQuizzes)
        .set({ disciplineId: remaining.disciplineId, updatedAt: new Date() })
        .where(eq(professorQuizzes.id, quizId));
    }
  }

  return { quiz };
}
