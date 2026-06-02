import { randomUUID } from "crypto";
import { Request, Response, Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import quizDatabase from "../database/quiz/quiz_database.json";
import { AppError } from "../exceptions/AppError";
import { getDb, checkDatabase } from "../db/client";
import {
  accountRoles,
  accounts,
  analysisSessions,
  answerAttempts,
  answerQuestions,
  chatMessages,
  chatSessions,
  chatTopicCounts,
  classes,
  classDisciplines,
  courses,
  disciplines,
  feedbacks,
  passwordHistory,
  professorClasses,
  professorCourses,
  professorDisciplines,
  professorProfiles,
  quizQuestionAttempts,
  quizSessions,
  studentDisciplines,
  studentProfiles,
  universities,
  userAnalyses,
} from "../db/schema";
import {
  createStudentAccount,
  findEntitiesByDisciplineCode,
  getAccountByEmail,
  getAccountById,
  getPublicMe,
  saveStudentQuizResult,
  startStudentSession,
} from "../db/repositories/authRepository";
import { normalizeSubjectFromMessage } from "../utils/normalizeSubject";
import { validateAndEnrichPrompt } from "../utils/subjectExtractor";
import { asyncHandler } from "../http/asyncHandler";
import { requireApiKey, requireAuth, requireEnv, requireRoles, prioritizeRoles, signSession } from "../http/auth";
import { clearAuthCookie, setAuthCookie } from "../http/cookies";
import { sendPasswordResetEmail } from "../services/email/mailService";
import { getFrontendOrigin } from "../config/env";

const routes = Router();
const runtimeSessions = new Map<string, RuntimeSession>();

type Filters = {
  universityId?: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
};

type RuntimeSession = {
  nivelAtual: string | null;
  lastAnswerKeys: string[];
  lastSubject: string | null;
  lastQuestions: string[];
  lastFullQuestions: QuizQuestion[];
};

type QuizQuestion = {
  question: string;
  options: string[];
  explanation?: Record<string, string>;
};

type Quiz = {
  subject: string;
  level: string;
  questions: QuizQuestion[];
  answer_keys: string[];
};

const allQuizzes = quizDatabase as Quiz[];
const levels = ["basico", "intermediario"];
const categories = ["variaveis", "listas", "condicionais", "funcoes", "operadores_logicos"];
const legacyCategories = ["variáveis", "listas", "condicionais", "funções", "operadores_lógicos"];
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

function getRuntimeSession(userId: string): RuntimeSession {
  const existing = runtimeSessions.get(userId);
  if (existing) return existing;
  const created = {
    nivelAtual: null,
    lastAnswerKeys: [],
    lastSubject: null,
    lastQuestions: [],
    lastFullQuestions: [],
  };
  runtimeSessions.set(userId, created);
  return created;
}

function button(title: string, payload: string) {
  return { title, payload };
}

function getLevels() {
  return levels.map((level) => button(level.charAt(0).toUpperCase() + level.slice(1), level));
}

function getCategories() {
  return legacyCategories.map((category) => button(category.toUpperCase().replace(/_/g, " "), category));
}

function getSubcategories(category: string) {
  const subs = subcategories[category] || subcategories[normalizeKey(category)];
  if (!subs) throw new AppError(`Categoria '${category}' nao encontrada.`, 404);
  return subs.map((sub) => button(formatTitle(sub), sub));
}

function normalizeKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ç/g, "c").replace(/õ/g, "o");
}

function formatTitle(value: string) {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function generateQuiz(subtopic: string, level: string): Quiz {
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

function verifyQuizAnswers(userAnswers: string[], correctAnswers: string[], originalQuestions: QuizQuestion[]) {
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

function generateDisciplineCode(universityId: string, courseId: string, classId: string, disciplineId: string) {
  const combined = `${universityId}${courseId}${classId}${disciplineId}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash &= hash;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(8, "0").substring(0, 8);
}

function formatSeconds(seconds: number) {
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

function emptySubjectCounts() {
  return { variaveis: 0, listas: 0, condicionais: 0, verificacoes: 0, operadores_logicos: 0, funcoes: 0, repeticao: 0 };
}

function analysisWhere(filters: Filters) {
  const conditions = [];
  if (filters.universityId) conditions.push(eq(userAnalyses.schoolId, filters.universityId));
  if (filters.courseId) conditions.push(eq(userAnalyses.courseId, filters.courseId));
  if (filters.classId) conditions.push(eq(userAnalyses.classId, filters.classId));
  if (filters.studentId) conditions.push(eq(userAnalyses.userId, filters.studentId));
  return conditions.length ? and(...conditions) : undefined;
}

async function closeOpenStudentSession(userId: string) {
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

async function addChatMessage(input: {
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

async function incrementTopicCount(userId: string, topic: string) {
  await getDb().insert(chatTopicCounts)
    .values({ userId, topic, count: 1 })
    .onConflictDoUpdate({
      target: [chatTopicCounts.userId, chatTopicCounts.topic],
      set: { count: sql`${chatTopicCounts.count} + 1` },
    });
}

async function queryQuestions(filters: Filters) {
  return getDb()
    .select({ subject: answerQuestions.subject, isCorrect: answerQuestions.isCorrect, timestamp: answerQuestions.timestamp })
    .from(answerQuestions)
    .innerJoin(answerAttempts, eq(answerAttempts.id, answerQuestions.attemptId))
    .innerJoin(analysisSessions, eq(analysisSessions.id, answerAttempts.sessionId))
    .innerJoin(userAnalyses, eq(userAnalyses.id, analysisSessions.analysisId))
    .where(analysisWhere(filters));
}

function aggregateByCategory(rows: { subject: string; isCorrect: boolean }[]) {
  const map: Record<string, { correct: number; wrong: number }> = {};
  for (const row of rows) {
    const category = normalizeSubjectFromMessage(row.subject) || row.subject;
    if (!map[category]) map[category] = { correct: 0, wrong: 0 };
    if (row.isCorrect) map[category].correct++;
    else map[category].wrong++;
  }
  return map;
}

async function getSummary(filters: { universityId: string; courseId?: string; classId?: string; studentId?: string }) {
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

function buildDailyUsage(sessions: Array<{ date: string; sessionDuration: number }>) {
  const byDay: Record<string, { date: string; usage: number; formatted: string }> = {};
  for (const session of sessions) {
    if (!byDay[session.date]) byDay[session.date] = { date: session.date, usage: 0, formatted: "00:00:00" };
    byDay[session.date].usage += session.sessionDuration / 60;
    byDay[session.date].formatted = formatSeconds(Math.round(byDay[session.date].usage * 60)).formatted;
  }
  return Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date));
}

function getEmptySummary() {
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

routes.use(requireApiKey);

routes.get("/health", asyncHandler(async (_req, res) => {
  const startedAt = Date.now();
  let database = "ok";
  try {
    await checkDatabase();
  } catch {
    database = "error";
  }
  return res.status(database === "ok" ? 200 : 503).json({
    status: database === "ok" ? "ok" : "degraded",
    runtime: "node-express",
    database,
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
}));
routes.get("/health/simple", (_req, res) => res.send("OK"));
routes.get("/health/ready", asyncHandler(async (_req, res) => {
  await checkDatabase();
  return res.json({ ready: true });
}));
routes.get("/ping", (_req, res) => res.send("pong"));

routes.post("/users", asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const code = String(req.body.code || "").trim();

  if (!name || !email || !password || !code) throw new AppError("Os campos name, email, password e code sao obrigatorios.", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("formato de e-mail invalido!", 400);
  if (password.length < 12) throw new AppError("a senha deve ter pelo menos 12 caracteres!", 400);

  const db = getDb();
  const existingUser = await getAccountByEmail(db, email);
  if (existingUser) throw new AppError("usuario ja existe com este email!", 409);

  const entities = await findEntitiesByDisciplineCode(db, code);
  if (!entities) throw new AppError("codigo de disciplina invalido!", 404);
  const { university, course, discipline, classes: linkedClasses } = entities;
  if (!linkedClasses.length) throw new AppError("a disciplina nao possui turmas cadastradas!", 400);

  const selectedClass = linkedClasses.find((item) => generateDisciplineCode(university.id, course.id, item.id, discipline.id) === code) || linkedClasses[0];
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createStudentAccount(db, {
    name,
    email,
    passwordHash,
    schoolId: university.id,
    courseId: course.id,
    classId: selectedClass.id,
    disciplineId: discipline.id,
  });
  if (!user) throw new AppError("falha ao criar usuario.", 500);

  return res.status(201).json({
    message: "Usuario criado com sucesso!",
    user: {
      user: {
        _id: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.roles,
        school: { _id: university.id, id: university.id, name: university.name },
        course: { _id: course.id, id: course.id, name: course.name },
        class: { _id: selectedClass.id, id: selectedClass.id, name: selectedClass.name },
        disciplines: [{ _id: discipline.id, id: discipline.id, name: discipline.name, code: discipline.code }],
      },
      assignedClass: { id: selectedClass.id, name: selectedClass.name },
      discipline: { id: discipline.id, name: discipline.name },
      course: { id: course.id, name: course.name },
      university: { id: university.id, name: university.name },
    },
  });
}));

routes.post("/session", asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const db = getDb();
  const user = await getAccountByEmail(db, email);
  if (!user || !password || !user.passwordHash) throw new AppError("credenciais invalidas.", 401);
  if (user.status !== "active") throw new AppError("sua conta esta inativa. entre em contato com o administrador.", 403);
  if (!await bcrypt.compare(password, user.passwordHash)) throw new AppError("credenciais invalidas.", 401);

  const roles = prioritizeRoles(user.roles || []);
  if (roles.includes("student")) await startStudentSession(db, user);
  const token = signSession({ id: user.id, name: user.name, email: user.email, role: roles, school: user.schoolId || null });
  setAuthCookie(req, res, token);

  return res.json({
    success: true,
    user: {
      id: user.id,
      _id: user.id,
      name: user.name,
      email: user.email,
      role: roles,
      school: user.schoolId,
      courses: roles.some((role) => ["professor", "course-coordinator"].includes(role)) ? (user.courses || []) : user.courseId,
      classes: roles.some((role) => ["professor", "course-coordinator"].includes(role)) ? (user.classes || []) : undefined,
      class: roles.includes("student") ? user.classId : undefined,
    },
    message: "login realizado com sucesso",
  });
}));

routes.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const account = await getAccountById(getDb(), req.user!.id);
  if (!account) throw new AppError("usuario nao encontrado!", 404);
  return res.json(await getPublicMe(getDb(), account));
}));

routes.post("/logout", requireAuth, asyncHandler(async (req, res) => {
  if (req.user?.role.includes("student")) await closeOpenStudentSession(req.user.id);
  clearAuthCookie(req, res);
  return res.json({ message: "logout realizado com sucesso" });
}));

routes.patch("/users/password", requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) throw new AppError("senha atual e nova senha sao obrigatorias", 400);
  if (newPassword.length < 6) throw new AppError("a nova senha deve ter no minimo 6 caracteres", 400);

  const db = getDb();
  const [account] = await db.select().from(accounts).where(eq(accounts.id, req.user!.id)).limit(1);
  if (!account?.passwordHash || !await bcrypt.compare(currentPassword, account.passwordHash)) {
    throw new AppError("senha atual invalida", 401);
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await db.insert(passwordHistory).values({ accountId: account.id, hash: account.passwordHash });
  await db.update(accounts).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(accounts.id, account.id));
  return res.json({ message: "senha atualizada com sucesso" });
}));

routes.patch("/users/:userId/name", requireAuth, asyncHandler(async (req, res) => {
  if (req.params.userId !== req.user!.id && !req.user!.role.includes("admin")) throw new AppError("acesso negado", 403);
  const name = String(req.body.name || req.body.newName || "").trim();
  if (!name) throw new AppError("nome obrigatorio", 400);
  const [account] = await getDb().update(accounts).set({ name, updatedAt: new Date() }).where(eq(accounts.id, req.params.userId)).returning();
  if (!account) throw new AppError("usuario nao encontrado", 404);
  return res.json({ message: "nome atualizado com sucesso", user: { id: account.id, _id: account.id, name: account.name, email: account.email } });
}));

routes.patch("/users/:userId/email", requireAuth, asyncHandler(async (req, res) => {
  if (req.params.userId !== req.user!.id && !req.user!.role.includes("admin")) throw new AppError("acesso negado", 403);
  const email = String(req.body.email || req.body.newEmail || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("email invalido", 400);
  const existing = await getAccountByEmail(getDb(), email);
  if (existing && existing.id !== req.params.userId) throw new AppError("email ja esta em uso", 409);
  const [account] = await getDb().update(accounts).set({ email, updatedAt: new Date() }).where(eq(accounts.id, req.params.userId)).returning();
  await getDb().update(userAnalyses).set({ email }).where(eq(userAnalyses.userId, req.params.userId));
  return res.json({ message: "email atualizado com sucesso", user: { id: account.id, _id: account.id, name: account.name, email: account.email } });
}));

routes.post("/password/send-reset-password", asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const account = await getAccountByEmail(getDb(), email);
  if (!account) return res.json({ message: "se o email existir, a recuperacao sera iniciada" });
  const token = jwt.sign({ email }, requireEnv("JWT_SECRET"), { expiresIn: "30m" });
  const frontendUrl = getFrontendOrigin(req.get("origin"));
  const resetLink = `${frontendUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

  await getDb().update(accounts)
    .set({ resetPasswordToken: token, resetPasswordExpires: new Date(Date.now() + 30 * 60 * 1000), updatedAt: new Date() })
    .where(eq(accounts.id, account.id));

  await sendPasswordResetEmail({ to: account.email, name: account.name, resetLink });
  const includeDebugResetData = process.env.PASSWORD_RESET_DEBUG_RESPONSE === "true";

  return res.json({
    message: "se o email existir, a recuperacao sera iniciada",
    resetToken: includeDebugResetData ? token : undefined,
    resetLink: includeDebugResetData ? resetLink : undefined,
  });
}));

routes.patch("/password/reset-password", asyncHandler(async (req, res) => {
  const token = String(req.body.token || "");
  const newPassword = String(req.body.newPassword || "");
  if (!token || !newPassword) throw new AppError("token e newPassword sao obrigatorios", 400);
  const decoded = jwt.verify(token, requireEnv("JWT_SECRET")) as { email?: string };
  const [account] = await getDb().select().from(accounts).where(eq(accounts.email, String(decoded.email || "").toLowerCase())).limit(1);
  if (!account || account.resetPasswordToken !== token || !account.resetPasswordExpires || new Date() > account.resetPasswordExpires) {
    throw new AppError("token invalido ou expirado.", 400);
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await getDb().insert(passwordHistory).values({ accountId: account.id, hash: account.passwordHash || "" });
  await getDb().update(accounts)
    .set({ passwordHash: hash, resetPasswordToken: null, resetPasswordExpires: null, updatedAt: new Date() })
    .where(eq(accounts.id, account.id));
  return res.json({ message: "senha redefinida com sucesso" });
}));

routes.get("/quiz/levels", requireAuth, (_req, res) => res.json({ buttons: getLevels() }));
routes.post("/quiz/set-level", requireAuth, (req, res, next) => {
  try {
    const nivel = String(req.body.nivel || "");
    if (!nivel) throw new AppError("nivel e obrigatorio", 400);
    getRuntimeSession(req.user!.id).nivelAtual = nivel;
    return res.json({ message: `Nivel definido como ${nivel}.`, categories: getCategories() });
  } catch (error) {
    return next(error);
  }
});
routes.post("/quiz/subcategories", requireAuth, (req, res, next) => {
  try {
    return res.json({ buttons: getSubcategories(String(req.body.category || "")) });
  } catch (error) {
    return next(error);
  }
});
routes.post("/quiz/generate", requireAuth, (req, res, next) => {
  try {
    const subtopic = String(req.body.subtopic || "");
    const session = getRuntimeSession(req.user!.id);
    if (!subtopic || !session.nivelAtual) throw new AppError("O nivel do usuario precisa ser definido.", 400);
    const quiz = generateQuiz(subtopic, session.nivelAtual);
    session.lastSubject = subtopic;
    session.lastFullQuestions = quiz.questions;
    session.lastAnswerKeys = quiz.answer_keys;
    return res.json({
      success: true,
      assunto: quiz.subject,
      nivel: quiz.level,
      questions: quiz.questions.map(({ question, options }) => ({ question, options })),
    });
  } catch (error) {
    return next(error);
  }
});
routes.post("/quiz/verify", requireAuth, asyncHandler(async (req, res) => {
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const session = getRuntimeSession(req.user!.id);
  if (!session.lastAnswerKeys.length || !session.lastFullQuestions.length) throw new AppError("Nenhum quiz ativo para verificar. Por favor, inicie um novo.", 400);
  const result = verifyQuizAnswers(answers, session.lastAnswerKeys, session.lastFullQuestions);
  if (req.user!.role.includes("student")) {
    await saveStudentQuizResult(getDb(), {
      userId: req.user!.id,
      email: req.user!.email,
      subject: session.lastSubject || "Assunto nao definido",
      level: session.nivelAtual || "Nivel nao definido",
      totalCorrectAnswers: result.totalCorrectAnswers,
      totalWrongAnswers: result.totalWrongAnswers,
      detalhes: result.detalhes,
    });
  }
  session.lastSubject = null;
  session.lastFullQuestions = [];
  session.lastAnswerKeys = [];
  return res.json({ success: true, ...result });
}));

routes.get("/sael/action/inicio", requireAuth, (_req, res) => res.json({ responses: [{ text: "Escolha se deseja conversar ou praticar com um quiz." }] }));
routes.post("/sael/action/conversar", requireAuth, (_req, res) => res.json({ responses: [{ text: "Vamos conversar, sobre o que quer falar?" }] }));
routes.post("/sael/talk", requireAuth, asyncHandler(async (req, res) => handleAsk(req, res)));
routes.get("/sael/action/listar_niveis", requireAuth, (_req, res) => res.json({ responses: [{ text: "Escolha um nivel:", buttons: getLevels() }] }));
routes.post("/sael/action/definir_nivel", requireAuth, (req, res, next) => {
  try {
    const nivel = String(req.body.nivel || "");
    if (!nivel) throw new AppError("nivel obrigatorio", 400);
    getRuntimeSession(req.user!.id).nivelAtual = nivel;
    return res.json({ responses: [{ text: `Nivel ${nivel} definido.` }] });
  } catch (error) {
    return next(error);
  }
});
routes.get("/sael/action/listar_opcoes", requireAuth, (_req, res) => res.json({ responses: [{ text: "Escolha um assunto:", buttons: getCategories() }] }));
routes.post("/sael/action/listar_subopcoes", requireAuth, (req, res, next) => {
  try {
    const categoria = String(req.body.categoria || "");
    getRuntimeSession(req.user!.id).lastSubject = categoria;
    return res.json({ responses: [{ text: "Escolha um topico:", buttons: getSubcategories(categoria) }] });
  } catch (error) {
    return next(error);
  }
});
routes.post("/sael/action/gerar_perguntas", requireAuth, (req, res, next) => {
  try {
    const pergunta = String(req.body.pergunta || "");
    const session = getRuntimeSession(req.user!.id);
    if (!pergunta || !session.nivelAtual) throw new AppError("pergunta e nivel sao obrigatorios", 400);
    const quiz = generateQuiz(pergunta, session.nivelAtual);
    session.lastSubject = pergunta;
    session.lastFullQuestions = quiz.questions;
    session.lastAnswerKeys = quiz.answer_keys;
    const questions = quiz.questions.map(({ question, options }) => ({ question, options }));
    return res.json({ perguntas: questions, questions, gabarito: quiz.answer_keys, answer_keys: quiz.answer_keys, nivel: quiz.level, assunto: quiz.subject });
  } catch (error) {
    return next(error);
  }
});
routes.get(["/sael/action/gabarito", "/sael/action/get_gabarito"], requireAuth, (req, res) => {
  const session = getRuntimeSession(req.user!.id);
  return res.json({ answer_keys: session.lastAnswerKeys, gabarito: session.lastAnswerKeys, assunto: session.lastSubject });
});
routes.post("/sael/action/send", requireAuth, asyncHandler(async (req, res) => {
  const respostas = Array.isArray(req.body.respostas) ? req.body.respostas : Array.isArray(req.body.answers) ? req.body.answers : [];
  const session = getRuntimeSession(req.user!.id);
  if (!session.lastAnswerKeys.length) throw new AppError("Nenhum quiz ativo para verificar.", 400);
  const result = verifyQuizAnswers(respostas, session.lastAnswerKeys, session.lastFullQuestions);
  if (req.user!.role.includes("student")) {
    await saveStudentQuizResult(getDb(), {
      userId: req.user!.id,
      email: req.user!.email,
      subject: session.lastSubject || "Assunto nao definido",
      level: session.nivelAtual || "Nivel nao definido",
      totalCorrectAnswers: result.totalCorrectAnswers,
      totalWrongAnswers: result.totalWrongAnswers,
      detalhes: result.detalhes,
    });
  }
  return res.json({ success: true, ...result });
}));
routes.post("/sael/action/perguntar", requireAuth, asyncHandler(async (req, res) => handleAsk(req, res)));

async function handleAsk(req: Request, res: Response) {
  const message = String(req.body.message || "");
  const sessionId = req.body.sessionId ? String(req.body.sessionId) : undefined;
  if (!message.trim()) throw new AppError("message e obrigatorio", 400);

  const validation = validateAndEnrichPrompt(message);
  const { sessionId: currentSessionId } = await addChatMessage({
    userId: req.user!.id,
    sessionId,
    role: "user",
    content: message,
    topic: validation?.subject || null,
  });

  const fallback = validation
    ? "No momento estou sem provedor de IA externo na VPS, mas posso continuar registrando sua pergunta e o topico para o professor acompanhar."
    : "Desculpe, so posso conversar sobre programacao, algoritmos e topicos relacionados.";

  await addChatMessage({ userId: req.user!.id, sessionId: currentSessionId, role: "assistant", content: fallback, topic: validation?.subject || null });
  if (validation?.subject) await incrementTopicCount(req.user!.id, validation.subject);
  return res.json({ responses: [{ recipient_id: req.user!.id, text: fallback }], sessionId: currentSessionId });
}

routes.get("/history/chat/sessions/:userId", requireAuth, asyncHandler(async (req, res) => {
  if (req.user!.id !== req.params.userId && !req.user!.role.includes("admin")) throw new AppError("acesso nao autorizado", 403);
  const sessions = await getDb()
    .select({ sessionId: chatSessions.sessionId, title: chatSessions.title, startedAt: chatSessions.startedAt, lastActivityAt: chatSessions.lastActivityAt })
    .from(chatSessions)
    .where(eq(chatSessions.userId, req.params.userId))
    .orderBy(desc(chatSessions.lastActivityAt));
  return res.json(sessions);
}));
routes.get("/history/chat/messages/:userId/:sessionId", requireAuth, asyncHandler(async (req, res) => {
  if (req.user!.id !== req.params.userId && !req.user!.role.includes("admin")) throw new AppError("acesso nao autorizado", 403);
  const [session] = await getDb().select().from(chatSessions).where(and(eq(chatSessions.userId, req.params.userId), eq(chatSessions.sessionId, req.params.sessionId)));
  if (!session) return res.json({ userId: req.params.userId, sessionId: req.params.sessionId, title: "Nova Conversa", messages: [] });
  const messages = await getDb().select().from(chatMessages).where(eq(chatMessages.chatSessionId, session.id)).orderBy(asc(chatMessages.timestamp));
  return res.json({ userId: req.params.userId, sessionId: session.sessionId, title: session.title, messages });
}));
routes.get("/history/quiz/:userId", requireAuth, asyncHandler(async (req, res) => {
  if (req.user!.id !== req.params.userId && !req.user!.role.includes("admin")) throw new AppError("acesso nao autorizado", 403);
  const rows = await getDb().select().from(quizSessions).where(eq(quizSessions.userId, req.params.userId)).orderBy(desc(quizSessions.completedAt));
  return res.json(rows);
}));

routes.post("/useranalysis/interaction", requireAuth, asyncHandler(async (req, res) => {
  const message = String(req.body.message || "");
  if (!message.trim()) throw new AppError("campo message e obrigatorio", 400);
  const category = normalizeSubjectFromMessage(message.trim());
  if (!category) return res.json({ success: true });
  const [analysis] = await getDb().select().from(userAnalyses).where(eq(userAnalyses.userId, req.user!.id)).limit(1);
  if (!analysis) return res.json({ success: true });
  const [session] = await getDb()
    .select()
    .from(analysisSessions)
    .where(and(eq(analysisSessions.analysisId, analysis.id), isNull(analysisSessions.sessionEnd)))
    .orderBy(desc(analysisSessions.sessionStart))
    .limit(1);
  if (!session) return res.json({ success: true });
  await getDb().update(analysisSessions)
    .set({
      subjectCountsChat: sql`jsonb_set(COALESCE(${analysisSessions.subjectCountsChat}, '{}')::jsonb, ARRAY[${category}], to_jsonb(COALESCE((${analysisSessions.subjectCountsChat}->>${category})::integer, 0) + 1))`,
      lastActivityAt: new Date(),
    })
    .where(eq(analysisSessions.id, session.id));
  return res.json({ success: true });
}));
routes.post("/useranalysis/subject-clicks", requireAuth, asyncHandler(async (req, res) => {
  const clicks = req.body.clicks as Record<string, number> | undefined;
  if (!clicks || typeof clicks !== "object") throw new AppError("payload invalido", 400);
  const [analysis] = await getDb().select().from(userAnalyses).where(eq(userAnalyses.userId, req.user!.id)).limit(1);
  if (!analysis) return res.json({ message: "Cliques de categoria contabilizados com sucesso." });
  const current = { ...((analysis.subjectCountsQuiz as Record<string, number>) || {}) };
  for (const [raw, count] of Object.entries(clicks)) {
    const category = normalizeSubjectFromMessage(raw) || "tipos";
    current[category] = (current[category] || 0) + Number(count || 0);
  }
  await getDb().update(userAnalyses).set({ subjectCountsQuiz: current }).where(eq(userAnalyses.id, analysis.id));
  return res.json({ message: "Cliques de categoria contabilizados com sucesso." });
}));

routes.get("/academicFilters/data", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const user = req.user!;
  const db = getDb();
  const isAdmin = user.role.includes("admin");
  const schoolId = user.school || undefined;

  const universityRows = isAdmin
    ? await db.select().from(universities)
    : schoolId
      ? await db.select().from(universities).where(eq(universities.id, schoolId))
      : [];
  const universityIds = universityRows.map((item) => item.id);
  const courseRows = universityIds.length
    ? await db.select().from(courses).where(inArray(courses.universityId, universityIds))
    : [];
  const courseIds = courseRows.map((item) => item.id);
  const classRows = courseIds.length ? await db.select().from(classes).where(inArray(classes.courseId, courseIds)) : [];
  const disciplineRows = courseIds.length ? await db.select().from(disciplines).where(inArray(disciplines.courseId, courseIds)) : [];
  const professorRows = await db
    .select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo, schoolId: professorProfiles.schoolId })
    .from(accounts)
    .innerJoin(professorProfiles, eq(professorProfiles.accountId, accounts.id));
  const studentRows = courseIds.length
    ? await db
      .select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo, status: accounts.status, classId: studentProfiles.classId, courseId: studentProfiles.courseId, level: studentProfiles.level })
      .from(accounts)
      .innerJoin(studentProfiles, eq(studentProfiles.accountId, accounts.id))
      .where(inArray(studentProfiles.courseId, courseIds))
    : [];
  const [classLinks, studentLinks, professorCourseLinks, professorDisciplineLinks, roleRows] = await Promise.all([
    disciplineRows.length ? db.select().from(classDisciplines).where(inArray(classDisciplines.disciplineId, disciplineRows.map((item) => item.id))) : [],
    studentRows.length ? db.select().from(studentDisciplines).where(inArray(studentDisciplines.studentId, studentRows.map((item) => item.id))) : [],
    professorRows.length ? db.select().from(professorCourses).where(inArray(professorCourses.professorId, professorRows.map((item) => item.id))) : [],
    professorRows.length ? db.select().from(professorDisciplines).where(inArray(professorDisciplines.professorId, professorRows.map((item) => item.id))) : [],
    professorRows.length ? db.select().from(accountRoles).where(inArray(accountRoles.accountId, professorRows.map((item) => item.id))) : [],
  ]);

  const data = universityRows.map((university) => ({
    _id: university.id,
    id: university.id,
    name: university.name,
    courses: courseRows.filter((course) => course.universityId === university.id).map((course) => ({
      _id: course.id,
      id: course.id,
      name: course.name,
      classes: classRows.filter((classItem) => classItem.courseId === course.id).map((classItem) => ({
        _id: classItem.id,
        id: classItem.id,
        name: classItem.name,
        disciplines: classLinks
          .filter((link) => link.classId === classItem.id)
          .flatMap((link) => disciplineRows.filter((discipline) => discipline.id === link.disciplineId).map((discipline) => ({ _id: discipline.id, id: discipline.id, name: discipline.name, code: discipline.code }))),
        students: studentRows.filter((student) => student.classId === classItem.id).map((student) => ({ _id: student.id, id: student.id, name: student.name, email: student.email, status: student.status, photo: student.photo, level: student.level })),
      })),
      disciplines: disciplineRows.filter((discipline) => discipline.courseId === course.id).map((discipline) => ({
        _id: discipline.id,
        id: discipline.id,
        name: discipline.name,
        code: discipline.code,
        classes: classLinks
          .filter((link) => link.disciplineId === discipline.id)
          .flatMap((link) => classRows.filter((classItem) => classItem.id === link.classId).map((classItem) => ({ _id: classItem.id, id: classItem.id, name: classItem.name }))),
        professors: professorDisciplineLinks
          .filter((link) => link.disciplineId === discipline.id)
          .flatMap((link) => professorRows.filter((professor) => professor.id === link.professorId).map((professor) => ({ _id: professor.id, id: professor.id, name: professor.name, email: professor.email, photo: professor.photo, role: roleRows.filter((role) => role.accountId === professor.id).map((role) => role.role) }))),
        students: studentLinks
          .filter((link) => link.disciplineId === discipline.id)
          .flatMap((link) => studentRows.filter((student) => student.id === link.studentId).map((student) => ({ _id: student.id, id: student.id, name: student.name, email: student.email, status: student.status, photo: student.photo }))),
      })),
      professors: professorCourseLinks
        .filter((link) => link.courseId === course.id)
        .flatMap((link) => professorRows.filter((professor) => professor.id === link.professorId).map((professor) => ({ _id: professor.id, id: professor.id, name: professor.name, email: professor.email, photo: professor.photo, role: roleRows.filter((role) => role.accountId === professor.id).map((role) => role.role) }))),
      students: studentRows.filter((student) => student.courseId === course.id).map((student) => ({ _id: student.id, id: student.id, name: student.name, email: student.email, status: student.status, photo: student.photo, level: student.level })),
    })),
  }));

  const summary = {
    universities: data.length,
    courses: courseRows.length,
    classes: classRows.length,
    disciplines: disciplineRows.length,
    professors: professorRows.length,
    students: studentRows.length,
  };

  return res.json({ success: true, data: { universities: data }, summary, user: { _id: user.id, name: user.name, email: user.email, role: user.role }, meta: { timestamp: new Date().toISOString(), version: "node" } });
}));

routes.post("/academic-institution/university", requireAuth, requireRoles(["admin"]), asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) throw new AppError("nome obrigatorio", 400);
  const [university] = await getDb().insert(universities).values({ name }).returning();
  return res.status(201).json({ message: "universidade criada com sucesso", university });
}));
routes.get("/academic-institution/university", requireAuth, requireRoles(["admin"]), asyncHandler(async (_req, res) => res.json(await getDb().select().from(universities).orderBy(asc(universities.name)))));
routes.delete("/academic-institution/university/:universityId", requireAuth, requireRoles(["admin"]), asyncHandler(async (req, res) => {
  await getDb().delete(universities).where(eq(universities.id, req.params.universityId));
  return res.json({ message: "universidade removida com sucesso" });
}));
routes.post("/academic-institution/course", requireAuth, requireRoles(["admin"]), asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const universityId = String(req.body.universityId || req.body.university || "");
  const [course] = await getDb().insert(courses).values({ name, universityId }).returning();
  return res.status(201).json({ message: "curso criado com sucesso", course });
}));
routes.get("/academic-institution/course/:universityId", requireAuth, requireRoles(["admin"]), asyncHandler(async (req, res) => res.json(await getDb().select().from(courses).where(eq(courses.universityId, req.params.universityId)).orderBy(asc(courses.name)))));
routes.delete("/academic-institution/course/:courseId", requireAuth, requireRoles(["admin"]), asyncHandler(async (req, res) => {
  await getDb().delete(courses).where(eq(courses.id, req.params.courseId));
  return res.json({ message: "curso removido com sucesso" });
}));
routes.post("/academic-institution/class", requireAuth, requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const courseId = String(req.body.courseId || req.body.course || "");
  const [classItem] = await getDb().insert(classes).values({ name, courseId }).returning();
  return res.status(201).json({ message: "turma criada com sucesso", class: classItem });
}));
routes.get("/academic-institution/class/:courseId", requireAuth, requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => res.json(await getDb().select().from(classes).where(eq(classes.courseId, req.params.courseId)).orderBy(asc(classes.name)))));
routes.delete("/academic-institution/class/:classId", requireAuth, requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  await getDb().delete(classes).where(eq(classes.id, req.params.classId));
  return res.json({ message: "turma removida com sucesso" });
}));
routes.post("/academic-institution/discipline", requireAuth, requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const courseId = String(req.body.courseId || req.body.course || "");
  const classIds = Array.isArray(req.body.classIds) ? req.body.classIds as string[] : [];
  const professorIds = Array.isArray(req.body.professorIds) ? req.body.professorIds as string[] : [];
  const [course] = await getDb().select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) throw new AppError("curso nao encontrado", 404);
  const [discipline] = await getDb().insert(disciplines).values({ name, courseId, code: randomUUID().slice(0, 8).toUpperCase() }).returning();
  const code = classIds[0] ? generateDisciplineCode(course.universityId, courseId, classIds[0], discipline.id) : discipline.code;
  await getDb().update(disciplines).set({ code }).where(eq(disciplines.id, discipline.id));
  if (classIds.length) await getDb().insert(classDisciplines).values(classIds.map((classId) => ({ classId, disciplineId: discipline.id }))).onConflictDoNothing();
  if (professorIds.length) await getDb().insert(professorDisciplines).values(professorIds.map((professorId) => ({ professorId, disciplineId: discipline.id }))).onConflictDoNothing();
  return res.status(201).json({ message: "disciplina criada com sucesso", discipline: { ...discipline, code } });
}));
routes.get("/academic-institution/discipline", requireAuth, requireRoles(["admin", "course-coordinator"]), asyncHandler(async (_req, res) => res.json(await getDb().select().from(disciplines).orderBy(asc(disciplines.name)))));
routes.delete("/academic-institution/discipline/:disciplineId", requireAuth, requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  await getDb().delete(disciplines).where(eq(disciplines.id, req.params.disciplineId));
  return res.json({ message: "disciplina removida com sucesso" });
}));

routes.post("/admin/professor", requireAuth, requireRoles(["admin"]), asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const schoolId = String(req.body.school || req.body.schoolId || "");
  const courseIds = Array.isArray(req.body.courses) ? req.body.courses as string[] : [];
  const classIds = Array.isArray(req.body.classes) ? req.body.classes as string[] : [];
  const disciplineIds = Array.isArray(req.body.disciplines) ? req.body.disciplines as string[] : [];
  if (!name || !email || !password || !schoolId) throw new AppError("name, email, password e school sao obrigatorios", 400);
  const [account] = await getDb().insert(accounts).values({ name, email, passwordHash: await bcrypt.hash(password, 10), status: "active" }).returning();
  await getDb().insert(accountRoles).values({ accountId: account.id, role: "professor" }).onConflictDoNothing();
  await getDb().insert(professorProfiles).values({ accountId: account.id, schoolId });
  if (courseIds.length) await getDb().insert(professorCourses).values(courseIds.map((courseId) => ({ professorId: account.id, courseId }))).onConflictDoNothing();
  if (classIds.length) await getDb().insert(professorClasses).values(classIds.map((classId) => ({ professorId: account.id, classId }))).onConflictDoNothing();
  if (disciplineIds.length) await getDb().insert(professorDisciplines).values(disciplineIds.map((disciplineId) => ({ professorId: account.id, disciplineId }))).onConflictDoNothing();
  return res.status(201).json({ message: "professor criado com sucesso", professor: { id: account.id, _id: account.id, name: account.name, email: account.email } });
}));
routes.delete("/admin/professor/:professorId", requireAuth, requireRoles(["admin"]), asyncHandler(async (req, res) => {
  await getDb().delete(accounts).where(eq(accounts.id, req.params.professorId));
  return res.json({ message: "professor removido com sucesso" });
}));
routes.get("/admin/professors", requireAuth, requireRoles(["admin"]), asyncHandler(async (_req, res) => {
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo, schoolId: professorProfiles.schoolId }).from(accounts).innerJoin(professorProfiles, eq(professorProfiles.accountId, accounts.id)).orderBy(asc(accounts.name));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));
routes.get("/admin/university/:schoolId/professors", requireAuth, requireRoles(["admin"]), asyncHandler(async (req, res) => {
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo }).from(accounts).innerJoin(professorProfiles, eq(professorProfiles.accountId, accounts.id)).where(eq(professorProfiles.schoolId, req.params.schoolId));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));
routes.get("/admin/course/:courseId/professors", requireAuth, requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo }).from(accounts).innerJoin(professorCourses, eq(professorCourses.professorId, accounts.id)).where(eq(professorCourses.courseId, req.params.courseId));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));
routes.patch("/admin/professor/:id/role", requireAuth, requireRoles(["admin"]), asyncHandler(async (req, res) => {
  const action = String(req.body.action || "");
  if (action === "add") await getDb().insert(accountRoles).values({ accountId: req.params.id, role: "course-coordinator" }).onConflictDoNothing();
  else if (action === "remove") await getDb().delete(accountRoles).where(and(eq(accountRoles.accountId, req.params.id), eq(accountRoles.role, "course-coordinator")));
  else throw new AppError("action deve ser add ou remove", 400);
  return res.json({ message: "papel atualizado com sucesso" });
}));
routes.get("/admin/students", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (_req, res) => {
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo, status: accounts.status, classId: studentProfiles.classId, courseId: studentProfiles.courseId, level: studentProfiles.level }).from(accounts).innerJoin(studentProfiles, eq(studentProfiles.accountId, accounts.id)).orderBy(asc(accounts.name));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));
routes.get("/admin/professor/students", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const professorId = req.user!.id;
  const links = await getDb().select({ disciplineId: professorDisciplines.disciplineId }).from(professorDisciplines).where(eq(professorDisciplines.professorId, professorId));
  if (!links.length) return res.json({ students: [] });
  const studentLinks = await getDb().select({ studentId: studentDisciplines.studentId }).from(studentDisciplines).where(inArray(studentDisciplines.disciplineId, links.map((link) => link.disciplineId)));
  if (!studentLinks.length) return res.json({ students: [] });
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo }).from(accounts).where(inArray(accounts.id, [...new Set(studentLinks.map((link) => link.studentId))]));
  return res.json({ students: rows.map((row) => ({ ...row, _id: row.id })) });
}));
routes.get("/admin/coordinator/professors", requireAuth, requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const courseIds = Array.isArray(req.user!.courses) ? req.user!.courses as string[] : [];
  if (!courseIds.length && !req.user!.role.includes("admin")) return res.json([]);
  const rows = req.user!.role.includes("admin")
    ? await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email }).from(accounts).innerJoin(professorProfiles, eq(professorProfiles.accountId, accounts.id))
    : await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email }).from(accounts).innerJoin(professorCourses, eq(professorCourses.professorId, accounts.id)).where(inArray(professorCourses.courseId, courseIds));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));
routes.get("/admin/coordinator/students", requireAuth, requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const courseIds = Array.isArray(req.user!.courses) ? req.user!.courses as string[] : [];
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email }).from(accounts).innerJoin(studentProfiles, eq(studentProfiles.accountId, accounts.id)).where(req.user!.role.includes("admin") || !courseIds.length ? undefined : inArray(studentProfiles.courseId, courseIds));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));
routes.get("/admin/coordinator/students/discipline/:disciplineId", requireAuth, requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const links = await getDb().select({ studentId: studentDisciplines.studentId }).from(studentDisciplines).where(eq(studentDisciplines.disciplineId, req.params.disciplineId));
  if (!links.length) return res.json([]);
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email }).from(accounts).where(inArray(accounts.id, links.map((link) => link.studentId)));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));
routes.get("/admin/coordinator/disciplines", requireAuth, requireRoles(["admin", "course-coordinator"]), asyncHandler(async (req, res) => {
  const courseIds = Array.isArray(req.user!.courses) ? req.user!.courses as string[] : [];
  const rows = req.user!.role.includes("admin") || !courseIds.length ? await getDb().select().from(disciplines) : await getDb().select().from(disciplines).where(inArray(disciplines.courseId, courseIds));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));
routes.get("/admin/coordinator/classes", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const courseIds = Array.isArray(req.user!.courses) ? req.user!.courses as string[] : [];
  const rows = req.user!.role.includes("admin") || !courseIds.length ? await getDb().select().from(classes) : await getDb().select().from(classes).where(inArray(classes.courseId, courseIds));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));
routes.get("/admin/classes/:classId/students", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email }).from(accounts).innerJoin(studentProfiles, eq(studentProfiles.accountId, accounts.id)).where(eq(studentProfiles.classId, req.params.classId));
  return res.json(rows.map((row) => ({ ...row, _id: row.id })));
}));
routes.delete("/admin/coordinator/student", requireAuth, requireRoles(["admin"]), asyncHandler(async (req, res) => {
  const studentId = String(req.query.studentId || "");
  if (!studentId) throw new AppError("studentId obrigatorio", 400);
  await getDb().delete(accounts).where(eq(accounts.id, studentId));
  return res.json({ message: "aluno removido com sucesso" });
}));

routes.post("/dashboard/topic-performance", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const byCategory = aggregateByCategory(await queryQuestions(req.body));
  return res.json(Object.entries(byCategory).map(([topic, values]) => {
    const total = values.correct + values.wrong;
    return { topic, successPercentage: total ? Number(((values.correct / total) * 100).toFixed(1)) : 0, errorPercentage: total ? Number(((values.wrong / total) * 100).toFixed(1)) : 0 };
  }));
}));
routes.post("/dashboard/proficiency-radar", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const byCategory = aggregateByCategory(await queryQuestions(req.body));
  const labels = Object.keys(byCategory).sort();
  return res.json({ labels, data: labels.map((label) => {
    const total = byCategory[label].correct + byCategory[label].wrong;
    return total ? Number(((byCategory[label].correct / total) * 100).toFixed(1)) : 0;
  }) });
}));
routes.post("/dashboard/effort-matrix", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const where = analysisWhere(req.body);
  const rows = where ? await getDb().select().from(userAnalyses).where(where) : await getDb().select().from(userAnalyses);
  if (!rows.length) return res.json({ points: [], averages: { avgPerformance: 0, avgEffort: 0 } });
  const points = rows.map((row) => {
    const total = row.totalCorrectAnswers + row.totalWrongAnswers;
    return { name: row.name, performance: total ? Number(((row.totalCorrectAnswers / total) * 100).toFixed(1)) : 0, effort: Number(((row.totalUsageTime || 0) / 60).toFixed(1)) };
  });
  return res.json({ points, averages: { avgPerformance: Number((points.reduce((sum, point) => sum + point.performance, 0) / points.length).toFixed(1)), avgEffort: Number((points.reduce((sum, point) => sum + point.effort, 0) / points.length).toFixed(1)) } });
}));
routes.post("/dashboard/learning-journey", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const rows = await queryQuestions(req.body);
  const ordered = rows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return res.json({ labels: ordered.map((_row, index) => `Questao ${index + 1}`), data: ordered.map((row) => row.isCorrect ? 100 : 0) });
}));
routes.post("/dashboard/session-details", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const filters = req.body as Filters & { startDate?: string; endDate?: string };
  const analyses = await getDb().select({ id: userAnalyses.id }).from(userAnalyses).where(analysisWhere(filters));
  if (!analyses.length) return res.json([]);
  const conditions = [inArray(analysisSessions.analysisId, analyses.map((item) => item.id)), isNotNull(analysisSessions.sessionEnd)];
  if (filters.startDate) conditions.push(gte(analysisSessions.sessionStart, new Date(filters.startDate)));
  if (filters.endDate) conditions.push(lte(analysisSessions.sessionStart, new Date(filters.endDate)));
  const rows = await getDb().select({ startTime: analysisSessions.sessionStart, endTime: analysisSessions.sessionEnd }).from(analysisSessions).where(and(...conditions));
  return res.json(rows);
}));
routes.post("/dashboard/access-pattern", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const analyses = await getDb().select({ id: userAnalyses.id }).from(userAnalyses).where(analysisWhere(req.body));
  if (!analyses.length) return res.json([]);
  const sessions = await getDb().select({ sessionStart: analysisSessions.sessionStart }).from(analysisSessions).where(inArray(analysisSessions.analysisId, analyses.map((item) => item.id)));
  const pattern: Record<string, number> = {};
  for (const session of sessions) {
    const date = new Date(session.sessionStart);
    const key = `${date.getUTCDay()}-${date.getUTCHours()}`;
    pattern[key] = (pattern[key] || 0) + 1;
  }
  return res.json(Object.entries(pattern).map(([key, count]) => [...key.split("-").map(Number), count]));
}));

routes.post("/logs/student/summary/filtered", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  if (!req.body.universityId) throw new AppError("universityId e obrigatorio", 400);
  return res.json(await getSummary(req.body));
}));
routes.get("/logs/university/:universityId/summary", requireAuth, requireRoles(["admin"]), asyncHandler(async (req, res) => res.json(await getSummary({ universityId: req.params.universityId }))));
routes.get("/logs/course/:courseId/summary", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const [analysis] = await getDb().select().from(userAnalyses).where(eq(userAnalyses.courseId, req.params.courseId)).limit(1);
  return res.json(analysis ? await getSummary({ universityId: analysis.schoolId, courseId: req.params.courseId }) : getEmptySummary());
}));
routes.get("/logs/class/:classId/summary", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const [analysis] = await getDb().select().from(userAnalyses).where(eq(userAnalyses.classId, req.params.classId)).limit(1);
  return res.json(analysis ? await getSummary({ universityId: analysis.schoolId, courseId: analysis.courseId, classId: req.params.classId }) : getEmptySummary());
}));
routes.get("/logs/discipline/:disciplineId/summary", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (_req, res) => res.json(getEmptySummary())));
routes.get("/logs/professor/students", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const professorId = req.user!.id;
  const links = await getDb().select({ disciplineId: professorDisciplines.disciplineId }).from(professorDisciplines).where(eq(professorDisciplines.professorId, professorId));
  if (!links.length) return res.json({ students: [] });
  const studentLinks = await getDb().select({ studentId: studentDisciplines.studentId }).from(studentDisciplines).where(inArray(studentDisciplines.disciplineId, links.map((link) => link.disciplineId)));
  if (!studentLinks.length) return res.json({ students: [] });
  const rows = await getDb().select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo }).from(accounts).where(inArray(accounts.id, [...new Set(studentLinks.map((link) => link.studentId))]));
  return res.json({ students: rows.map((row) => ({ ...row, _id: row.id })) });
}));
routes.get("/logs/professor/students/:studentId", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const [analysis] = await getDb().select().from(userAnalyses).where(eq(userAnalyses.userId, req.params.studentId)).limit(1);
  return res.json(analysis ? await getSummary({ universityId: analysis.schoolId, courseId: analysis.courseId, classId: analysis.classId, studentId: req.params.studentId }) : getEmptySummary());
}));
routes.get("/logs/professor/students-stats", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), (_req, res) => res.json({ totalStudents: 0, avgCorrect: 0, avgWrong: 0, avgUsageTime: 0 }));
routes.get("/logs/:entity/:id/accuracy", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const summary = await summaryByEntity(req.params.entity, req.params.id);
  const total = summary.totalCorrectAnswers + summary.totalWrongAnswers;
  return res.json({
    correct: summary.totalCorrectAnswers,
    wrong: summary.totalWrongAnswers,
    accuracy: total ? Number(((summary.totalCorrectAnswers / total) * 100).toFixed(1)) : 0,
  });
}));
routes.get("/logs/:entity/:id/usage", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const summary = await summaryByEntity(req.params.entity, req.params.id);
  return res.json({ usageTime: summary.usageTime, usageTimeInSeconds: summary.usageTimeInSeconds, dailyUsage: summary.dailyUsage });
}));
routes.get("/logs/:entity/:id/subjects/summary", requireAuth, requireRoles(["admin", "professor", "course-coordinator"]), asyncHandler(async (req, res) => {
  const summary = await summaryByEntity(req.params.entity, req.params.id);
  return res.json({ subjectCounts: summary.subjectCounts });
}));

async function summaryByEntity(entity: string, id: string) {
  if (entity === "university") return getSummary({ universityId: id });
  if (entity === "course") {
    const [analysis] = await getDb().select().from(userAnalyses).where(eq(userAnalyses.courseId, id)).limit(1);
    return analysis ? getSummary({ universityId: analysis.schoolId, courseId: id }) : getEmptySummary();
  }
  if (entity === "class") {
    const [analysis] = await getDb().select().from(userAnalyses).where(eq(userAnalyses.classId, id)).limit(1);
    return analysis ? getSummary({ universityId: analysis.schoolId, courseId: analysis.courseId, classId: id }) : getEmptySummary();
  }
  if (entity === "student") {
    const [analysis] = await getDb().select().from(userAnalyses).where(eq(userAnalyses.userId, id)).limit(1);
    return analysis ? getSummary({ universityId: analysis.schoolId, courseId: analysis.courseId, classId: analysis.classId, studentId: id }) : getEmptySummary();
  }
  return getEmptySummary();
}

routes.post("/feedbacks/send", requireAuth, asyncHandler(async (req, res) => {
  const message = String(req.body.message || "").trim();
  const type = String(req.body.type || "general");
  if (!message) throw new AppError("a mensagem e obrigatoria.", 400);
  const [account] = await getDb().select().from(accounts).where(eq(accounts.id, req.user!.id)).limit(1);
  if (!account) throw new AppError("usuario nao encontrado.", 404);
  const isVip = req.user!.role.includes("admin") || req.user!.role.includes("course-coordinator");
  if (!isVip && account.lastFeedbackAt) {
    const diffMinutes = (Date.now() - new Date(account.lastFeedbackAt).getTime()) / (1000 * 60);
    if (diffMinutes < 2) throw new AppError(`aguarde ${Math.ceil(2 - diffMinutes)} minuto(s) para enviar novamente.`, 429);
  }
  await getDb().insert(feedbacks).values({ accountId: account.id, type, message });
  await getDb().update(accounts).set({ lastFeedbackAt: new Date(), updatedAt: new Date() }).where(eq(accounts.id, account.id));
  return res.json({ message: "feedback enviado com sucesso!" });
}));

routes.use((req, res) => res.status(404).json({ success: false, message: "rota nao encontrada", path: req.path }));

export { routes };
