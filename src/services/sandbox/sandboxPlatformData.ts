import { randomUUID } from "crypto";
import { asc, eq, inArray, sql } from "drizzle-orm";
import type { DbClient } from "../../db/client";
import {
  accountRoles,
  accounts,
  chatMessageFeedback,
  chatMessages,
  chatSessions,
  exerciseAttempts,
  exerciseHints,
  feedbacks,
  flashcardReviews,
  notifications,
  professorDisciplines,
  professorProfiles,
  professorQuizzes,
  studentProfiles,
} from "../../db/schema";
import { buildTruthTable, truthTableCellKey } from "../logic/logicCore";
import { PARSONS_EXERCISES, TRANSLATION_EXERCISES } from "../logic/exerciseCatalog";
import { createQuestion } from "../questions/questionBankService";
import { closeExam, createExam, publishExam } from "../exams/examService";
import { startExam, submitExam } from "../exams/examSubmissionService";
import { getBlindReview, releaseResults, saveReview } from "../exams/blindReviewService";
import { prepareExerciseAttempt, recordExerciseAttempt } from "../exercises/exerciseAttemptService";
import { seededRandom, type DemoPeriod } from "./sandboxDemoData";
import { buildHintContext } from "../exercises/hintService";
import { sandboxEmail } from "./sandboxConfig";

const DAY = 86400000;
type StaffUser = NonNullable<import("express").Request["user"]>;

/* Short texts, all fictitious, in the platform's main language. */
const QUESTIONS: Record<string, string[]> = {
  variaveis: ["Como declaro uma variável?", "Qual a diferença entre variável e constante?", "Posso mudar o tipo de uma variável?"],
  condicionais: ["Quando uso se/senão?", "Como funciona o operador lógico E dentro do se?", "O que é um condicional aninhado?"],
  listas: ["Como percorro uma lista?", "Qual a diferença entre lista e vetor?", "Como acesso o último elemento?"],
  funcoes: ["O que é o retorno de uma função?", "Para que servem os parâmetros?", "Qual a diferença entre função e procedimento?"],
  operadores_logicos: ["Quando p → q é falso?", "Como monto a tabela-verdade de p ∧ q?", "O que significa a negação de p ∨ q?"],
};
const ANSWER = (topic: string) => `Explicação sobre ${topic.replace("_", " ")}: um exemplo passo a passo, os erros mais comuns e um exercício curto para praticar.`;
const REASONS = ["incorrect", "incomplete", "unclear", "off_topic", "other"] as const;
const COMMENTS: Record<string, string[]> = {
  partial: ["Ajudou, mas faltou um exemplo prático.", "A explicação ficou longa demais.", "Entendi a ideia, mas não o código."],
  down: ["A resposta não tinha relação com a minha pergunta.", "O exemplo tinha um erro.", "Ficou confuso, precisei pesquisar em outro lugar."],
};
const FEEDBACK: Array<[string, string]> = [
  ["ELOGIO", "O chat me ajudou muito a entender condicionais."],
  ["SUGESTAO", "Seria bom ter mais exercícios de montagem de algoritmos."],
  ["BUG", "A tabela-verdade demorou para carregar no celular."],
  ["GERAL", "Gostei da bancada de exercícios, é fácil de usar."],
  ["SUGESTAO", "Poderia ter um modo escuro mais forte."],
  ["BUG", "Ao trocar de idioma o quiz voltou para a primeira pergunta."],
  ["ELOGIO", "As provas online são bem organizadas."],
];

export interface PlatformSummary { chats: number; ratings: number; feedbacks: number; questions: number; exercises: number; hints: number; exams: number; submissions: number; notifications: number; flashcardReviews: number }

/**
 * Everything around the dashboards: chat with ratings, feedback, question bank, workbench,
 * exams (with blind grading and released results) and notifications. Rules are applied by the
 * platform's own services, so the data looks exactly like real use.
 */
export async function generatePlatformData(db: DbClient, days: DemoPeriod, now = new Date()): Promise<PlatformSummary> {
  const summary: PlatformSummary = { chats: 0, ratings: 0, feedbacks: 0, questions: 0, exercises: 0, hints: 0, exams: 0, submissions: 0, notifications: 0, flashcardReviews: 0 };
  if (days === 0) return summary;
  const random = seededRandom(days * 104729);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const at = (back: number, hour = between(8, 21)) => new Date(Math.min(now.getTime(), now.getTime() - back * DAY + (hour - now.getUTCHours()) * 3600000));

  const students = await db.select({ id: accounts.id, classId: studentProfiles.classId }).from(studentProfiles)
    .innerJoin(accounts, eq(accounts.id, studentProfiles.accountId)).orderBy(asc(accounts.email));
  // Professors of both institutions: each fills the bank and the exams of their own subjects.
  const professors = await db.select({ id: accounts.id, name: accounts.name, email: accounts.email, school: professorProfiles.schoolId })
    .from(accounts).innerJoin(professorProfiles, eq(professorProfiles.accountId, accounts.id))
    .where(inArray(accounts.email, [sandboxEmail("professor"), sandboxEmail("professor2")])).orderBy(asc(accounts.email));
  const professor = professors.find((row) => row.email === sandboxEmail("professor"));

  /* ── Chat: conversations, answers and ratings (useful / more or less / not useful) ── */
  const chatRows: Array<typeof chatSessions.$inferInsert> = [];
  const messageRows: Array<typeof chatMessages.$inferInsert> = [];
  const ratingRows: Array<typeof chatMessageFeedback.$inferInsert> = [];
  for (const student of students) {
    const conversations = Math.min(12, Math.max(1, Math.round(days / 6)));
    for (let index = 0; index < conversations; index++) {
      const back = between(0, days - 1);
      const started = at(back);
      const topic = pick(Object.keys(QUESTIONS));
      const sessionRow = { id: randomUUID(), userId: student.id, sessionId: randomUUID(), title: pick(QUESTIONS[topic]), startedAt: started, lastActivityAt: started };
      chatRows.push(sessionRow);
      const turns = between(1, 3);
      for (let turn = 0; turn < turns; turn++) {
        const time = new Date(started.getTime() + turn * 4 * 60000);
        const question = turn === 0 ? sessionRow.title : pick(QUESTIONS[topic]);
        messageRows.push({ chatSessionId: sessionRow.id, role: "user", content: question, detectedTopic: topic, metadata: { outputLanguage: "pt-BR" }, timestamp: time });
        const answerId = randomUUID();
        messageRows.push({ id: answerId, chatSessionId: sessionRow.id, role: "assistant", content: ANSWER(topic), detectedTopic: topic, metadata: { outputLanguage: "pt-BR" }, timestamp: new Date(time.getTime() + 20000) });
        sessionRow.lastActivityAt = new Date(time.getTime() + 20000);
        if (random() < 0.6) {
          const roll = random();
          const rating = roll < 0.55 ? "up" : roll < 0.8 ? "partial" : "down";
          ratingRows.push({
            messageId: answerId, accountId: student.id, rating,
            reason: rating === "up" ? null : random() < 0.8 ? pick(REASONS) : null,
            comment: rating === "up" ? null : random() < 0.6 ? pick(COMMENTS[rating]) : null,
            createdAt: new Date(time.getTime() + 60000), updatedAt: new Date(time.getTime() + 60000),
          });
        }
      }
    }
  }
  await batch(chatRows, (rows) => db.insert(chatSessions).values(rows));
  await batch(messageRows, (rows) => db.insert(chatMessages).values(rows));
  await batch(ratingRows, (rows) => db.insert(chatMessageFeedback).values(rows));
  summary.chats = chatRows.length;
  summary.ratings = ratingRows.length;

  /* ── Feedback tab: students, the professor and the coordination ── */
  const staff = await db.select({ id: accounts.id }).from(accounts).innerJoin(accountRoles, eq(accountRoles.accountId, accounts.id))
    .where(inArray(accountRoles.role, ["professor", "course-coordinator"]));
  const authors = [...students.map((student) => student.id), ...staff.map((row) => row.id)];
  const feedbackRows = Array.from({ length: Math.min(authors.length, Math.max(4, Math.round(days / 4))) }, (_item, index) => {
    const [type, message] = FEEDBACK[index % FEEDBACK.length];
    return { accountId: authors[(index * 7) % authors.length], type, message, createdAt: at(between(0, days - 1)) };
  });
  await batch(feedbackRows, (rows) => db.insert(feedbacks).values(rows));
  summary.feedbacks = feedbackRows.length;

  /* ── Question bank, workbench and exams: taught by the test professors ── */
  for (const professor of professors) {
    const disciplineIds = (await db.select({ id: professorDisciplines.disciplineId }).from(professorDisciplines).where(eq(professorDisciplines.professorId, professor.id))).map((row) => row.id);
    const user: StaffUser = { id: professor.id, name: professor.name, email: professor.email, role: ["professor"], school: professor.school, disciplines: disciplineIds };
    const disciplineId = disciplineIds[0];
    if (disciplineId) {
      const base = { disciplineId, weight: 1, subject: "operadores_logicos", concepts: [], language: "pt-BR" };
      const created = {
        quiz: await createQuestion(db, user, { ...base, concepts: ["conditional"], type: "quiz", statement: "Quanto vale p → q com p = V e q = F?", content: { options: ["Verdadeiro", "Falso"], correct: 1 } }),
        truth: await createQuestion(db, user, { ...base, type: "truth_table", statement: "Monte a tabela-verdade do condicional.", content: { formula: "p -> q" }, practiceEnabled: true }),
        // A large table (6 propositions, 64 rows) asked with the final column only.
        bigTruth: await createQuestion(db, user, { ...base, type: "truth_table", statement: "Quando a fórmula é verdadeira? Preencha só o resultado de cada linha.", content: { formula: "(p & q) | (r & s) | (t & u)", columns: "final" }, practiceEnabled: true }),
        translation: await createQuestion(db, user, { ...base, type: "translation", statement: "Se estudo, então passo.", practiceEnabled: true, content: { legend: [{ letter: "e", text: "estudo" }, { letter: "a", text: "passo" }], target: "e -> a" } }),
        parsons: await createQuestion(db, user, { ...base, concepts: ["selection"], type: "parsons", statement: "Mostre o maior de dois números.", practiceEnabled: true, content: { solution: "leia a, b\nse a > b então\n  escreva a\nsenão\n  escreva b\nfimse", distractors: "escreva a + b", alternatives: "" } }),
        essay: await createQuestion(db, user, { ...base, concepts: ["conditional"], type: "essay", weight: 2, statement: "Explique quando o condicional é falso, com um exemplo.", content: { criteria: "Citar o caso V → F e dar um exemplo." } }),
      };
      summary.questions += Object.keys(created).length;

      // Exams: one already graded and released, and (for longer periods) one open now.
      const examStudents = (await db.select({ id: studentProfiles.accountId }).from(studentProfiles)
        .where(inArray(studentProfiles.classId, Array.from(new Set(students.map((student) => student.classId)))))).map((row) => row.id);
      const released = await createExam(db, user, { title: "Prova 1 · Lógica proposicional", disciplineId, questionIds: [created.quiz.id, created.truth.id, created.translation.id, created.essay.id], timeLimitMinutes: 50 });
      const publishedAt = at(Math.max(1, Math.floor(days / 2)));
      await publishExam(db, user, released.id, publishedAt);
      summary.exams++;
      for (const studentId of examStudents) {
        if (random() > 0.85) continue;
        try {
          const startedAt = new Date(publishedAt.getTime() + between(1, 48) * 3600000);
          const attempt = await startExam(db, studentId, released.id, startedAt);
          const byType = (type: string) => attempt.questions.find((question) => question.type === type)!.id;
          const good = random() < 0.6;
          await submitExam(db, studentId, released.id, { answers: {
            [byType("quiz")]: { choice: good ? 1 : 0 },
            [byType("truth_table")]: { cells: good ? { "0|p → q": true, "1|p → q": false, "2|p → q": true, "3|p → q": true } : { "0|p → q": true, "1|p → q": true, "2|p → q": false, "3|p → q": true } },
            [byType("translation")]: { text: good ? "~e | a" : "a -> e" },
            [byType("essay")]: { text: good ? "É falso quando o antecedente é verdadeiro e o consequente é falso, por exemplo: se chove, então molha; chove e não molha." : "Quando é falso." },
          } }, new Date(startedAt.getTime() + between(15, 45) * 60000));
          summary.submissions++;
        } catch {
          // A student outside the exam's classes is simply skipped.
        }
      }
      await closeExam(db, user, released.id, new Date(publishedAt.getTime() + 4 * DAY > now.getTime() ? now.getTime() - 60000 : publishedAt.getTime() + 4 * DAY));
      const review = await getBlindReview(db, user, released.id);
      for (const question of review.questions) for (const item of question.items)
        await saveReview(db, user, item.id, { score: item.text.length > 40 ? 1 : item.text ? 0.5 : 0, comment: item.text.length > 40 ? "Muito bem, exemplo claro." : "Faltou o exemplo." });
      await releaseResults(db, user, released.id);
      if (days >= 7) {
        const open = await createExam(db, user, { title: "Prova 2 · Revisão", disciplineId, questionIds: [created.quiz.id, created.parsons.id], timeLimitMinutes: 30 });
        await publishExam(db, user, open.id, at(1));
        summary.exams++;
      }
    }
  }

  /* ── Workbench: truth tables, translations and algorithms, right and wrong ── */
  const truthTable = buildTruthTable("p -> q");
  for (const student of students) {
    for (let index = Math.min(20, Math.max(2, Math.round(days / 5))); index > 0; index--) {
      const kind = pick(["truth_table", "translation", "parsons"] as const);
      const right = random() < 0.62;
      let body: Record<string, unknown>;
      if (kind === "truth_table") {
        const cells: Record<string, boolean> = {};
        truthTable.rows.forEach((row, rowIndex) => truthTable.columns.forEach((column, columnIndex) => {
          cells[truthTableCellKey(rowIndex, column.key)] = right || rowIndex !== 1 ? row.values[columnIndex] : !row.values[columnIndex];
        }));
        body = { type: "truth_table", source: "catalog", formula: "p -> q", cells };
      } else if (kind === "translation") {
        const exercise = pick(TRANSLATION_EXERCISES);
        const letters = exercise.legend.map((entry) => entry.letter);
        body = { type: "translation", exerciseId: exercise.id, answer: right ? exercise.target : `${letters[letters.length - 1]} & ~${letters[0]}` };
      } else {
        const exercise = pick(PARSONS_EXERCISES);
        const solution = exercise.solutions[0].map(([id, indent]) => ({ id, indent }));
        body = { type: "parsons", exerciseId: exercise.id, solution: right ? solution : solution.slice().reverse() };
      }
      try {
        const hintsUsed = right ? 0 : between(0, 2);
        const attempt = prepareExerciseAttempt({ ...body, hintsUsed, durationMs: between(40, 400) * 1000, events: [] });
        const saved = await recordExerciseAttempt(db, student.id, attempt);
        const createdAt = at(between(0, days - 1));
        await db.update(exerciseAttempts).set({ createdAt }).where(eq(exerciseAttempts.id, saved.attemptId));
        summary.exercises++;
        // Hints the student asked for on wrong answers (built-in texts: no model call in the test data).
        if (hintsUsed > 0) {
          const context = buildHintContext({ exerciseType: attempt.exerciseType, exerciseId: attempt.exerciseId, concepts: attempt.concepts, submittedState: attempt.submittedState, result: attempt.result }, "pt-BR");
          const rows = Array.from({ length: hintsUsed }, (_item, index) => ({
            studentId: student.id, attemptId: saved.attemptId, exerciseId: attempt.exerciseId, level: index + 1,
            source: "fallback", usedMaterial: false, text: context.fallback(index + 1), language: "pt-BR", createdAt,
          }));
          summary.hints += (await db.insert(exerciseHints).values(rows).onConflictDoNothing().returning({ id: exerciseHints.id })).length;
        }
      } catch {
        // An answer that the engine refuses is just not recorded.
      }
    }
  }

  /* ── Flash cards: each student reviewed part of the decks of their class's subjects ── */
  const cards = await db.execute(sql`
    SELECT sp.account_id AS student_id, f.id AS card_id FROM student_profiles sp
    JOIN class_disciplines cd ON cd.class_id = sp.class_id
    JOIN flashcard_decks d ON d.discipline_id = cd.discipline_id AND d.published AND d.archived_at IS NULL
    JOIN flashcards f ON f.deck_id = d.id
    ORDER BY sp.account_id, f.position`);
  const reviewRows: Array<typeof flashcardReviews.$inferInsert> = [];
  for (const row of cards.rows as Array<{ student_id: string; card_id: string }>) {
    if (random() < 0.35) continue; // not seen yet
    const box = between(1, 5);
    const updatedAt = at(between(0, days - 1));
    const reviews = box + between(0, 2);
    reviewRows.push({ studentId: row.student_id, cardId: row.card_id, box, reviews, correct: Math.max(0, box - 1), lastRating: box >= 3 ? "good" : random() < 0.5 ? "hard" : "again",
      dueAt: new Date(updatedAt.getTime() + [0, 0.007, 1, 3, 7, 21][box] * DAY), updatedAt });
  }
  await batch(reviewRows, (rows) => db.insert(flashcardReviews).values(rows).onConflictDoNothing());
  summary.flashcardReviews = reviewRows.length;

  /* ── Notifications: new quizzes and exam results for students, progress for the professor ── */
  const quizzes = await db.select({ id: professorQuizzes.id, title: professorQuizzes.title, createdAt: professorQuizzes.createdAt }).from(professorQuizzes).orderBy(asc(professorQuizzes.createdAt));
  const noteRows: Array<typeof notifications.$inferInsert> = [];
  for (const student of students) {
    for (const quiz of quizzes.slice(-3)) {
      noteRows.push({ recipientId: student.id, type: "quiz_published", groupKey: `quiz:${quiz.id}`, params: { quizTitle: quiz.title, disciplineName: "Lógica de Programação" }, link: `/quiz/${quiz.id}`, readAt: random() < 0.5 ? quiz.createdAt : null, createdAt: quiz.createdAt, updatedAt: quiz.createdAt });
    }
    noteRows.push({ recipientId: student.id, type: "exam_results_released", groupKey: `exam-results:${days}`, params: { examTitle: "Prova 1 · Lógica proposicional" }, link: "/exams", readAt: null, createdAt: at(0), updatedAt: at(0) });
  }
  if (professor) for (const quiz of quizzes.slice(-3)) {
    noteRows.push({ recipientId: professor.id, type: "quiz_completion_progress", groupKey: `quiz-progress:${quiz.id}`, params: { quizTitle: quiz.title, completed: between(5, 20), total: 30, lastStudentName: "Aluno 3 (teste)" }, link: "/quiz/manage", readAt: null, createdAt: quiz.createdAt, updatedAt: quiz.createdAt });
  }
  await batch(noteRows, (rows) => db.insert(notifications).values(rows).onConflictDoNothing());
  summary.notifications = noteRows.length;
  return summary;
}

async function batch<T>(rows: T[], insert: (rows: T[]) => Promise<unknown>) {
  for (let index = 0; index < rows.length; index += 500) await insert(rows.slice(index, index + 500));
}
