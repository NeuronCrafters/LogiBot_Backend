import { getLanguage, normalizeLanguage, withLanguage, t, type Language } from "../../i18n";
import { getDb } from "../../db/client";
import {
  professorQuizAiGenerations,
  professorQuizQuestionSources,
  professorQuizQuestions,
  professorQuizzes,
} from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { logger } from "../../logger";
import { askQuizAiAgent } from "../ai/quizAiAgentService";
import { retrieveChunksForQuiz } from "./quizAiRetrievalService";
import { assertProfessorCanManageDiscipline } from "./quizPermissionService";

type AuthUser = NonNullable<import("express").Request["user"]>;

type GeneratedQuestion = {
  question: string;
  options: [string, string, string, string];
  correctOption: "A" | "B" | "C" | "D";
  explanation: string;
  sourceChunkIds?: string[];
};

type GeneratedQuiz = {
  title: string;
  description: string;
  questions: GeneratedQuestion[];
  error?: string;
};

export type QuizAiGenerationInput = {
  user: AuthUser;
  disciplineId: string;
  theme: string;
  questionCount: number;
  documentIds: string[];
  title?: string;
  description?: string;
  language?: Language;
};

function truncate(value: string | undefined | null, max: number): string {
  if (!value) return "";
  return value.trim().slice(0, max);
}

function buildPrompt(input: {
  theme: string;
  questionCount: number;
  context: string;
}): string {
  return t("quiz.generationPrompt", { theme: input.theme, count: input.questionCount, context: input.context });
}

function extractJson(text: string): GeneratedQuiz {
  const cleaned = text
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch)
    throw new AppError("quiz.jsonMissing", 502);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new AppError("quiz.jsonMalformed", 502);
  }

  return parsed;
}

function validateQuizJson(
  raw: GeneratedQuiz,
  expectedCount: number,
): GeneratedQuestion[] {
  if (raw.error) {
    throw new AppError({ key: "quiz.contextInsufficient", params: { value0: raw.error } },
      400,
    );
  }

  if (!Array.isArray(raw.questions)) {
    throw new AppError("quiz.questionsMissing", 502);
  }

  if (raw.questions.length === 0) {
    throw new AppError("quiz.noQuestionsGenerated",
      400,
    );
  }

  if (raw.questions.length !== expectedCount) {
    throw new AppError({ key: "quiz.questionCountMismatch", params: { value0: raw.questions.length, value1: expectedCount } },
      502,
    );
  }

  const valid: GeneratedQuestion[] = [];
  const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

  for (let i = 0; i < raw.questions.length; i++) {
    const q = raw.questions[i];

    if (!q.question?.trim())
      throw new AppError({ key: "quiz.questionEmpty", params: { value0: i + 1 } }, 502);

    if (!Array.isArray(q.options) || q.options.length !== 4)
      throw new AppError({ key: "quiz.fourOptionsRequired", params: { value0: i + 1 } },
        502,
      );

    const optTexts = q.options.map((o: string) => o?.trim() ?? "");
    if (optTexts.some((o: string) => !o))
      throw new AppError({ key: "quiz.optionEmpty", params: { value0: i + 1 } }, 502);

    const unique = new Set(optTexts.map((o: string) => o.toLowerCase()));
    if (unique.size !== 4)
      throw new AppError({ key: "quiz.optionsDuplicate", params: { value0: i + 1 } },
        502,
      );

    const correct = String(q.correctOption || "").trim().toUpperCase();
    if (!VALID_OPTIONS.has(correct))
      throw new AppError({ key: "quiz.correctOptionInvalid", params: { value0: i + 1, value1: q.correctOption } },
        502,
      );

    if (!q.explanation?.trim())
      throw new AppError({ key: "quiz.explanationEmpty", params: { value0: i + 1 } }, 502);

    valid.push({
      question: truncate(q.question, 1000),
      options: optTexts.map((o: string) => truncate(o, 300)) as [
        string,
        string,
        string,
        string,
      ],
      correctOption: correct as "A" | "B" | "C" | "D",
      explanation: truncate(q.explanation, 1200),
      sourceChunkIds: Array.isArray(q.sourceChunkIds)
        ? q.sourceChunkIds.filter((id: any) => typeof id === "string")
        : [],
    });
  }

  return valid;
}

export async function generateAiQuiz(input: QuizAiGenerationInput) {
  const { user, disciplineId, theme, questionCount, documentIds } = input;
  const language = input.language || getLanguage();

  if (!theme?.trim())
    throw new AppError("quiz.themeRequired", 400);
  if (theme.trim().length > 180)
    throw new AppError("quiz.themeTooLong", 400);
  if (!Number.isInteger(questionCount) || questionCount < 3 || questionCount > 10)
    throw new AppError("quiz.questionCountRange", 400);
  if (!documentIds.length)
    throw new AppError("quiz.documentRequired", 400);

  await assertProfessorCanManageDiscipline(user, disciplineId);

  logger.info("QuizAI", "Starting quiz generation.", {
    professorId: user.id,
    disciplineId,
    questionCount,
    documentCount: documentIds.length,
    theme,
  });

  const t0 = Date.now();

  const { chunks, selectedDocuments } = await retrieveChunksForQuiz({
    user,
    theme: theme.trim(),
    documentIds,
    questionCount,
  });

  logger.info("QuizAI", "Retrieval done.", {
    retrievedChunks: chunks.length,
    elapsedMs: Date.now() - t0,
  });

  if (!chunks.length) {
    throw new AppError("quiz.noRelevantContent",
      400,
    );
  }

  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.documentTitle} (${t("common.chunk", { number: c.chunkIndex + 1 }, language)})\n${c.content}`,
    )
    .join("\n\n");

  const prompt = withLanguage(language, () => buildPrompt({ theme: theme.trim(), questionCount, context }));

  const t1 = Date.now();
  const agentResponse = await withLanguage(language, () => askQuizAiAgent(prompt));
  logger.info("QuizAI", "Agent responded.", {
    elapsedMs: Date.now() - t1,
  });

  const rawJson = extractJson(agentResponse.text);
  const questions = validateQuizJson(rawJson, questionCount);

  const db = getDb();

  const quizTitle = truncate(
    input.title || rawJson.title || t("quiz.defaultTitle", { theme: theme.trim() }, language),
    120,
  );
  const quizDescription = truncate(
    input.description || rawJson.description || null,
    500,
  );

  const [quiz] = await db
    .insert(professorQuizzes)
    .values({
      professorId: user.id,
      disciplineId,
      classId: null,
      generationSource: "ai",
      language,
      title: quizTitle,
      topic: truncate(theme.trim(), 180),
      description: quizDescription || null,
      status: "draft",
    })
    .returning();

  const insertedQuestions = await db
    .insert(professorQuizQuestions)
    .values(
      questions.map((q, index) => ({
        quizId: quiz.id,
        question: q.question,
        options: q.options,
        correctOption: q.correctOption,
        explanation: q.explanation,
        orderIndex: index,
      })),
    )
    .returning();

  const chunkRefs = chunks.map((c) => `${c.documentId}:${c.chunkIndex}`);

  await db.insert(professorQuizAiGenerations).values({
    quizId: quiz.id,
    professorId: user.id,
    classId: null,
    disciplineId,
    theme: theme.trim(),
    questionCount,
    selectedDocumentIds: documentIds,
    retrievedChunkRefs: chunkRefs,
    provider: agentResponse.provider,
    model: null,
    language,
    status: "done",
  });

  for (let i = 0; i < insertedQuestions.length; i++) {
    const q = insertedQuestions[i];
    const sourceIds = questions[i].sourceChunkIds ?? [];
    if (!sourceIds.length) continue;

    const sourcesToInsert: {
      questionId: string;
      documentId: string;
      chromaId: string | null;
      chunkIndex: number | null;
      score: number | null;
      contentExcerpt: string | null;
    }[] = [];

    for (const ref of sourceIds) {
      const [docId, chunkIdxStr] = ref.split(":");
      const chunkIndex = parseInt(chunkIdxStr, 10);
      const chunk = chunks.find(
        (c) =>
          c.documentId === docId &&
          (Number.isNaN(chunkIndex) || c.chunkIndex === chunkIndex),
      );
      if (!chunk) continue;

      sourcesToInsert.push({
        questionId: q.id,
        documentId: chunk.documentId,
        chromaId: chunk.chromaId,
        chunkIndex: chunk.chunkIndex,
        score: chunk.score,
        contentExcerpt: chunk.content.slice(0, 300),
      });
    }

    if (sourcesToInsert.length) {
      await db
        .insert(professorQuizQuestionSources)
        .values(sourcesToInsert);
    }
  }

  logger.info("QuizAI", "Quiz created as draft.", {
    quizId: quiz.id,
    questionCount: insertedQuestions.length,
    totalElapsedMs: Date.now() - t0,
  });

  return {
    quiz,
    questions: insertedQuestions,
    sourceSummary: {
      documentCount: selectedDocuments.length,
      retrievedChunkCount: chunks.length,
    },
  };
}
