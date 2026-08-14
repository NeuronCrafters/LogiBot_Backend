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
};

function truncate(value: string | undefined | null, max: number): string {
  if (!value) return "";
  return value.trim().slice(0, max);
}

// A identidade, as regras de qualidade e o contrato de saída (JSON) do
// gerador de quiz vivem no system prompt configurado no próprio Agent
// dedicado da DigitalOcean (ver PROMPT_QUIZ.md). Aqui só enviamos o que é
// dinâmico por request: tema, quantidade e o contexto recuperado.
function buildPrompt(input: {
  theme: string;
  questionCount: number;
  context: string;
}): string {
  return `Tema: "${input.theme}"
Quantidade de perguntas: ${input.questionCount}

Contexto dos materiais da turma:
${input.context}`;
}

function extractJson(text: string): GeneratedQuiz {
  const cleaned = text
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch)
    throw new AppError("IA não retornou JSON válido", 502);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new AppError("IA retornou JSON malformado", 502);
  }

  return parsed;
}

function validateQuizJson(
  raw: GeneratedQuiz,
  expectedCount: number,
): GeneratedQuestion[] {
  if (raw.error) {
    throw new AppError(
      `IA indicou contexto insuficiente: ${raw.error}`,
      400,
    );
  }

  if (!Array.isArray(raw.questions)) {
    throw new AppError("IA retornou estrutura inválida (sem questions)", 502);
  }

  if (raw.questions.length === 0) {
    throw new AppError(
      "IA não conseguiu gerar perguntas com o contexto fornecido",
      400,
    );
  }

  if (raw.questions.length !== expectedCount) {
    throw new AppError(
      `IA gerou ${raw.questions.length} pergunta(s) mas ${expectedCount} foram solicitadas`,
      502,
    );
  }

  const valid: GeneratedQuestion[] = [];
  const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

  for (let i = 0; i < raw.questions.length; i++) {
    const q = raw.questions[i];

    if (!q.question?.trim())
      throw new AppError(`Pergunta ${i + 1} tem enunciado vazio`, 502);

    if (!Array.isArray(q.options) || q.options.length !== 4)
      throw new AppError(
        `Pergunta ${i + 1} deve ter exatamente 4 alternativas`,
        502,
      );

    const optTexts = q.options.map((o: string) => o?.trim() ?? "");
    if (optTexts.some((o: string) => !o))
      throw new AppError(`Pergunta ${i + 1} tem alternativa vazia`, 502);

    const unique = new Set(optTexts.map((o: string) => o.toLowerCase()));
    if (unique.size !== 4)
      throw new AppError(
        `Pergunta ${i + 1} tem alternativas duplicadas`,
        502,
      );

    const correct = String(q.correctOption || "").trim().toUpperCase();
    if (!VALID_OPTIONS.has(correct))
      throw new AppError(
        `Pergunta ${i + 1} tem correctOption inválido: "${q.correctOption}"`,
        502,
      );

    if (!q.explanation?.trim())
      throw new AppError(`Pergunta ${i + 1} tem explicação vazia`, 502);

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

  if (!theme?.trim())
    throw new AppError("Tema é obrigatório", 400);
  if (theme.trim().length > 180)
    throw new AppError("Tema deve ter no máximo 180 caracteres", 400);
  if (!Number.isInteger(questionCount) || questionCount < 3 || questionCount > 10)
    throw new AppError("questionCount deve ser entre 3 e 10", 400);
  if (!documentIds.length)
    throw new AppError("Selecione ao menos um documento", 400);

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
    throw new AppError(
      "Nenhum conteúdo relevante encontrado nos documentos para o tema informado",
      400,
    );
  }

  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.documentTitle} (trecho ${c.chunkIndex + 1})\n${c.content}`,
    )
    .join("\n\n");

  const prompt = buildPrompt({ theme: theme.trim(), questionCount, context });

  const t1 = Date.now();
  const agentResponse = await askQuizAiAgent(prompt);
  logger.info("QuizAI", "Agent responded.", {
    elapsedMs: Date.now() - t1,
  });

  const rawJson = extractJson(agentResponse.text);
  const questions = validateQuizJson(rawJson, questionCount);

  const db = getDb();

  const quizTitle = truncate(
    input.title || rawJson.title || `Quiz: ${theme.trim()}`,
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
