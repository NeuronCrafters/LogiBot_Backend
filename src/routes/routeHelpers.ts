import { randomUUID } from "crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import quizDatabase from "../database/quiz/quiz_database.json";
import { AppError } from "../exceptions/AppError";
import { getDb } from "../db/client";
import { askDigitalOceanAgent, AgentMessage } from "../services/ai/digitalOceanAgentService";
import {
  analysisSessions,
  answerAttempts,
  answerQuestions,
  chatMessages,
  chatSessions,
  chatTopicCounts,
  classes,
  courses,
  disciplines,
  universities,
  userAnalyses,
} from "../db/schema";
import { normalizeSubjectFromMessage } from "../utils/normalizeSubject";
import { validateAndEnrichPrompt } from "../utils/subjectExtractor";

export type Filters = {
  universityId?: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
};

export type RuntimeSession = {
  nivelAtual: string | null;
  lastAnswerKeys: string[];
  lastSubject: string | null;
  lastQuestions: string[];
  lastFullQuestions: QuizQuestion[];
};

export type QuizQuestion = {
  question: string;
  options: string[];
  explanation?: Record<string, string>;
};

export type Quiz = {
  subject: string;
  level: string;
  questions: QuizQuestion[];
  answer_keys: string[];
};

const allQuizzes = quizDatabase as Quiz[];
const runtimeSessions = new Map<string, RuntimeSession>();

const levels = ["basico", "intermediario"];
const categories = ["variáveis", "listas", "condicionais", "funções", "operadores_lógicos"];
const subcategories: Record<string, string[]> = {
  variaveis: [
    "o_que_sao_variaveis",
    "tipos_existentes_de_variaveis",
    "variaveis_mutaveis",
    "operacoes_de_concatenacao_de_textos",
    "o_que_sao_caracteres",
    "como_converter_caracteres",
  ],
  "variáveis": [
    "o_que_são_variáveis",
    "tipos_existentes_de_variáveis",
    "variáveis_mutáveis",
    "operações_de_concatenacao_de_textos",
    "o_que_são_caracteres",
    "como_converter_caracteres",
  ],
  listas: [
    "o_que_sao_listas",
    "adicionar_elemento_na_lista",
    "remover_elemento_da_lista",
    "ordenar_lista",
    "acessar_elemento_da_lista",
  ],
  condicionais: ["o_que_sao_condicionais", "o_que_são_condicionais"],
  funcoes: ["o_que_sao_funcoes", "como_usar_funcoes", "tipos_de_funcoes"],
  "funções": ["o_que_são_funções", "como_usar_funções", "tipos_de_funções"],
  operadores_logicos: ["o_que_sao_operadores_logicos"],
  "operadores_lógicos": ["o_que_são_operadores_lógicos"],
};

function button(title: string, payload: string) {
  return { title, payload };
}

export function getRuntimeSession(userId: string): RuntimeSession {
  const existing = runtimeSessions.get(userId);
  if (existing) return existing;

  const created: RuntimeSession = {
    nivelAtual: null,
    lastAnswerKeys: [],
    lastSubject: null,
    lastQuestions: [],
    lastFullQuestions: [],
  };
  runtimeSessions.set(userId, created);
  return created;
}

export function getLevels() {
  return levels.map((level) => button(level.charAt(0).toUpperCase() + level.slice(1), level));
}

export function getCategories() {
  return categories.map((category) => button(category.toUpperCase().replace(/_/g, " "), category));
}

export function getSubcategories(category: string) {
  const subs = subcategories[category] || subcategories[normalizeKey(category)];
  if (!subs) throw new AppError(`Categoria '${category}' nao encontrada.`, 404);
  return subs.map((sub) => button(formatTitle(sub), sub));
}

export function normalizeKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ç/g, "c").replace(/õ/g, "o");
}

export function formatTitle(value: string) {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function generateQuiz(subtopic: string, level: string): Quiz {
  const normalizedSubtopic = normalizeKey(subtopic).toLowerCase();
  const matchingQuizzes = allQuizzes.filter((quiz) => (
    normalizeKey(quiz.subject).toLowerCase() === normalizedSubtopic
    && normalizeKey(quiz.level).toLowerCase() === normalizeKey(level).toLowerCase()
  ));

  if (!matchingQuizzes.length) {
    throw new AppError(`Nenhum quiz encontrado para o topico '${subtopic}' no nivel '${level}'.`, 404);
  }

  return matchingQuizzes[Math.floor(Math.random() * matchingQuizzes.length)];
}

function optionText(letter: string, question?: QuizQuestion) {
  if (!letter || !question?.options) return "Resposta invalida";
  const index = letter.charCodeAt(0) - "A".charCodeAt(0);
  return question.options[index] || "Opcao nao encontrada";
}

export function verifyQuizAnswers(userAnswers: string[], correctAnswers: string[], originalQuestions: QuizQuestion[]) {
  let correctCount = 0;
  const detalhes = correctAnswers.map((correctAnswerRaw, index) => {
    const selected = (userAnswers[index] || "").trim().toUpperCase();
    const correct = (correctAnswerRaw || "").trim().toUpperCase();
    const isCorrect = selected === correct;
    if (isCorrect) correctCount++;
    const question = originalQuestions[index];
    return {
      question: question?.question || "Pergunta nao encontrada",
      selected,
      correct,
      isCorrect,
      explanation: question?.explanation?.[selected] || "Nao foi encontrada uma explicacao para esta opcao.",
      selectedText: optionText(selected, question),
      correctText: optionText(correct, question),
    };
  });

  return {
    message: `Voce acertou ${correctCount} de ${correctAnswers.length}.`,
    totalCorrectAnswers: correctCount,
    totalWrongAnswers: correctAnswers.length - correctCount,
    detalhes,
  };
}

export function generateDisciplineCode(universityId: string, courseId: string, classId: string, disciplineId: string) {
  const combined = `${universityId}${courseId}${classId}${disciplineId}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash &= hash;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(8, "0").substring(0, 8);
}

export function formatSeconds(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return {
    totalSeconds,
    hours,
    minutes,
    seconds: secs,
    formatted: `${pad(hours)}:${pad(minutes)}:${pad(secs)}`,
    humanized: hours > 0 ? `${hours}h ${minutes}min ${secs}s` : minutes > 0 ? `${minutes}min ${secs}s` : `${secs}s`,
  };
}

export function emptySubjectCounts() {
  return { variaveis: 0, listas: 0, condicionais: 0, verificacoes: 0, operadores_logicos: 0, funcoes: 0, repeticao: 0 };
}

export function analysisWhere(filters: Filters) {
  const conditions = [];
  if (filters.universityId) conditions.push(eq(userAnalyses.schoolId, filters.universityId));
  if (filters.courseId) conditions.push(eq(userAnalyses.courseId, filters.courseId));
  if (filters.classId) conditions.push(eq(userAnalyses.classId, filters.classId));
  if (filters.studentId) conditions.push(eq(userAnalyses.userId, filters.studentId));
  return conditions.length ? and(...conditions) : undefined;
}

export async function closeOpenStudentSession(userId: string) {
  const db = getDb();
  const [analysis] = await db.select().from(userAnalyses).where(eq(userAnalyses.userId, userId)).limit(1);
  if (!analysis) return;

  const [session] = await db
    .select()
    .from(analysisSessions)
    .where(and(eq(analysisSessions.analysisId, analysis.id), isNull(analysisSessions.sessionEnd)))
    .orderBy(desc(analysisSessions.sessionStart))
    .limit(1);

  if (!session) return;
  const end = new Date();
  const duration = Math.floor((end.getTime() - new Date(session.sessionStart).getTime()) / 1000);
  await db.update(analysisSessions)
    .set({ sessionEnd: end, sessionDuration: duration, lastActivityAt: end })
    .where(eq(analysisSessions.id, session.id));
  await db.update(userAnalyses)
    .set({ totalUsageTime: analysis.totalUsageTime + duration })
    .where(eq(userAnalyses.id, analysis.id));
}

export async function addChatMessage(input: {
  userId: string;
  sessionId?: string;
  role: "user" | "assistant";
  content: string;
  topic?: string | null;
}) {
  const db = getDb();
  const currentSessionId = input.sessionId || randomUUID();
  await db.insert(chatSessions)
    .values({ userId: input.userId, sessionId: currentSessionId, title: "Nova Conversa" })
    .onConflictDoUpdate({
      target: [chatSessions.userId, chatSessions.sessionId],
      set: { lastActivityAt: new Date() },
    });

  const [session] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, input.userId), eq(chatSessions.sessionId, currentSessionId)));

  await db.insert(chatMessages).values({
    chatSessionId: session.id,
    role: input.role,
    content: input.content,
    detectedTopic: input.topic || null,
  });

  return { sessionId: currentSessionId };
}

export async function getRecentChatMessages(userId: string, sessionId: string, limit = 10): Promise<AgentMessage[]> {
  const db = getDb();
  const [session] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, userId), eq(chatSessions.sessionId, sessionId)));

  if (!session) return [];

  const rows = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.chatSessionId, session.id))
    .orderBy(desc(chatMessages.timestamp))
    .limit(limit);

  return rows
    .reverse()
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({ role: row.role as "user" | "assistant", content: row.content }));
}

export async function incrementTopicCount(userId: string, topic: string) {
  await getDb().insert(chatTopicCounts)
    .values({ userId, topic, count: 1 })
    .onConflictDoUpdate({
      target: [chatTopicCounts.userId, chatTopicCounts.topic],
      set: { count: sql`${chatTopicCounts.count} + 1` },
    });
}

export async function queryQuestions(filters: Filters) {
  return getDb()
    .select({ subject: answerQuestions.subject, isCorrect: answerQuestions.isCorrect, timestamp: answerQuestions.timestamp })
    .from(answerQuestions)
    .innerJoin(answerAttempts, eq(answerAttempts.id, answerQuestions.attemptId))
    .innerJoin(analysisSessions, eq(analysisSessions.id, answerAttempts.sessionId))
    .innerJoin(userAnalyses, eq(userAnalyses.id, analysisSessions.analysisId))
    .where(analysisWhere(filters));
}

export function aggregateByCategory(rows: { subject: string; isCorrect: boolean }[]) {
  const map: Record<string, { correct: number; wrong: number }> = {};
  for (const row of rows) {
    const category = normalizeSubjectFromMessage(row.subject) || row.subject;
    if (!map[category]) map[category] = { correct: 0, wrong: 0 };
    if (row.isCorrect) map[category].correct++;
    else map[category].wrong++;
  }
  return map;
}

export async function getSummary(filters: { universityId: string; courseId?: string; classId?: string; studentId?: string }) {
  const db = getDb();
  const conditions = [eq(userAnalyses.schoolId, filters.universityId)];
  if (filters.courseId) conditions.push(eq(userAnalyses.courseId, filters.courseId));
  if (filters.classId) conditions.push(eq(userAnalyses.classId, filters.classId));
  if (filters.studentId) conditions.push(eq(userAnalyses.userId, filters.studentId));

  const analyses = await db.select().from(userAnalyses).where(and(...conditions));
  if (!analyses.length) return getEmptySummary();

  const analysisIds = analyses.map((analysis) => analysis.id);
  const sessions = await db
    .select()
    .from(analysisSessions)
    .where(inArray(analysisSessions.analysisId, analysisIds))
    .orderBy(desc(analysisSessions.sessionStart));

  const analysisUserMap = new Map(analyses.map((analysis) => [analysis.id, { userId: analysis.userId, name: analysis.name }]));
  const subjectCounts = emptySubjectCounts();
  let totalCorrectAnswers = 0;
  let totalWrongAnswers = 0;
  let totalUsageTime = 0;
  const processedSessions: Array<{
    date: string;
    sessionStart: Date | null;
    sessionEnd: Date | null;
    sessionDuration: number;
    userId: string;
    userName: string;
    usage: number;
    formatted: string;
  }> = [];

  for (const analysis of analyses) {
    totalCorrectAnswers += analysis.totalCorrectAnswers;
    totalWrongAnswers += analysis.totalWrongAnswers;
    totalUsageTime += analysis.totalUsageTime || 0;
  }

  for (const session of sessions) {
    const chatCounts = (session.subjectCountsChat || {}) as Record<string, number>;
    for (const [key, value] of Object.entries(chatCounts)) {
      const normalized = normalizeSubjectFromMessage(key) || key;
      if (normalized in subjectCounts) subjectCounts[normalized as keyof typeof subjectCounts] += Number(value || 0);
    }

    if (session.sessionStart && session.sessionEnd && session.sessionDuration) {
      const info = analysisUserMap.get(session.analysisId);
      const date = new Date(session.sessionStart).toISOString().split("T")[0];
      processedSessions.push({
        date,
        sessionStart: session.sessionStart,
        sessionEnd: session.sessionEnd,
        sessionDuration: session.sessionDuration,
        userId: info?.userId || "",
        userName: info?.name || "",
        usage: session.sessionDuration / 60,
        formatted: formatSeconds(session.sessionDuration).formatted,
      });
    }
  }

  return {
    totalCorrectAnswers,
    totalWrongAnswers,
    usageTimeInSeconds: totalUsageTime,
    usageTime: formatSeconds(totalUsageTime),
    subjectCounts,
    sessions: processedSessions,
    dailyUsage: buildDailyUsage(processedSessions),
    users: filters.studentId ? analyses[0] || null : null,
  };
}

export function buildDailyUsage(sessions: Array<{ date: string; sessionDuration: number }>) {
  const byDay: Record<string, { date: string; usage: number; formatted: string }> = {};
  for (const session of sessions) {
    if (!byDay[session.date]) byDay[session.date] = { date: session.date, usage: 0, formatted: "00:00:00" };
    byDay[session.date].usage += session.sessionDuration / 60;
    byDay[session.date].formatted = formatSeconds(Math.round(byDay[session.date].usage * 60)).formatted;
  }
  return Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date));
}

export function getEmptySummary() {
  return {
    totalCorrectAnswers: 0,
    totalWrongAnswers: 0,
    usageTimeInSeconds: 0,
    usageTime: formatSeconds(0),
    subjectCounts: emptySubjectCounts(),
    sessions: [],
    dailyUsage: [],
    users: null,
  };
}

export async function summaryByEntity(entity: string, id: string) {
  if (entity === "university" || entity === "universities") return getSummary({ universityId: id });
  if (entity === "course" || entity === "courses") {
    const [analysis] = await getDb().select().from(userAnalyses).where(eq(userAnalyses.courseId, id)).limit(1);
    return analysis ? getSummary({ universityId: analysis.schoolId, courseId: id }) : getEmptySummary();
  }
  if (entity === "class" || entity === "classes") {
    const [analysis] = await getDb().select().from(userAnalyses).where(eq(userAnalyses.classId, id)).limit(1);
    return analysis ? getSummary({ universityId: analysis.schoolId, courseId: analysis.courseId, classId: id }) : getEmptySummary();
  }
  if (entity === "student" || entity === "students") {
    const [analysis] = await getDb().select().from(userAnalyses).where(eq(userAnalyses.userId, id)).limit(1);
    return analysis ? getSummary({ universityId: analysis.schoolId, courseId: analysis.courseId, classId: analysis.classId, studentId: id }) : getEmptySummary();
  }
  return getEmptySummary();
}

function buildAgentMessages(
  history: AgentMessage[],
  detectedTopic: string | null,
  currentMessage: string,
): AgentMessage[] {
  const systemLines = [
    "Voce e o LogiBot, um tutor de logica de programacao.",
    "Responda SEMPRE em portugues do Brasil.",
    "REGRA PRINCIPAL: responda diretamente a pergunta do usuario. Nao peca mais contexto quando a pergunta ja e clara.",
    "Seja claro, direto e didatico. Use exemplos de codigo em JavaScript ou pseudocodigo quando ajudar.",
    "Priorize a base de conhecimento conectada ao Agent da DigitalOcean quando ela trouxer contexto relevante.",
    "Ajude o aluno a raciocinar; se parecer uma avaliacao ou quiz, guie sem entregar a resposta pronta.",
    "Perguntas fora de programacao, algoritmos e logica: responda 'Posso ajudar com programacao, algoritmos e logica de programacao. Pode me perguntar sobre variaveis, funcoes, estruturas de dados, etc!'",
  ];

  if (detectedTopic) {
    systemLines.push(`Topico identificado: ${formatTitle(detectedTopic)}. Responda a pergunta do usuario sobre este topico.`);
  }

  return [
    { role: "system", content: systemLines.join("\n") },
    ...history,
  ];
}

export async function handleAsk(req: any, res: any) {
  const userId = req.user!.id;
  const message = String(req.body.message || req.body.text || "").trim();
  const providedSessionId = req.body.sessionId ? String(req.body.sessionId) : undefined;
  if (!message) throw new AppError("message e obrigatorio", 400);

  const enriched = validateAndEnrichPrompt(message);
  const detectedTopic = enriched?.subject ?? null;

  const userMessage = await addChatMessage({ userId, sessionId: providedSessionId, role: "user", content: message, topic: detectedTopic });
  if (detectedTopic) await incrementTopicCount(userId, detectedTopic);

  const history = await getRecentChatMessages(userId, userMessage.sessionId);
  const agentResponse = await askDigitalOceanAgent(buildAgentMessages(history, detectedTopic, message));

  const responseText = agentResponse?.text ?? "Tive um problema tecnico ao processar sua mensagem. Pode tentar novamente?";
  const provider = agentResponse?.provider ?? "fallback";

  await addChatMessage({ userId, sessionId: userMessage.sessionId, role: "assistant", content: responseText, topic: detectedTopic });
  return res.json({ responses: [{ text: responseText }], sessionId: userMessage.sessionId, detectedTopic, provider });
}
