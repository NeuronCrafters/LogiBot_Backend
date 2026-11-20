import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  status: text("status").notNull().default("active"),
  photo: text("photo"),
  preferredLanguage: text("preferred_language"),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordExpires: timestamp("reset_password_expires", {
    withTimezone: true,
  }),
  lastFeedbackAt: timestamp("last_feedback_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  languageCheck: check("accounts_preferred_language_check", sql`${table.preferredLanguage} IS NULL OR ${table.preferredLanguage} IN ('pt-BR', 'en-US', 'es-ES')`),
}));

export const accountRoles = pgTable(
  "account_roles",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.accountId, table.role] }),
  }),
);

export const universities = pgTable("universities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    universityId: uuid("university_id")
      .notNull()
      .references(() => universities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueNameByUniversity: uniqueIndex("courses_name_university_idx").on(
      table.name,
      table.universityId,
    ),
  }),
);

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    registrationCode: text("registration_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueNameByCourse: uniqueIndex("classes_name_course_idx").on(
      table.name,
      table.courseId,
    ),
    uniqueRegistrationCode: uniqueIndex("classes_registration_code_idx").on(
      table.registrationCode,
    ),
  }),
);

export const disciplines = pgTable(
  "disciplines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueNameByCourse: uniqueIndex("disciplines_name_course_idx").on(
      table.name,
      table.courseId,
    ),
  }),
);

export const studentProfiles = pgTable("student_profiles", {
  accountId: uuid("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => universities.id),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id),
  level: text("level").notNull().default("desconhecido"),
});

export const professorProfiles = pgTable("professor_profiles", {
  accountId: uuid("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => universities.id),
});

export const passwordHistory = pgTable("password_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  hash: text("hash").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const classDisciplines = pgTable(
  "class_disciplines",
  {
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    disciplineId: uuid("discipline_id")
      .notNull()
      .references(() => disciplines.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.classId, table.disciplineId] }),
  }),
);

export const professorCourses = pgTable(
  "professor_courses",
  {
    professorId: uuid("professor_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.professorId, table.courseId] }),
  }),
);

export const professorClasses = pgTable(
  "professor_classes",
  {
    professorId: uuid("professor_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.professorId, table.classId] }),
  }),
);

export const professorDisciplines = pgTable(
  "professor_disciplines",
  {
    professorId: uuid("professor_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    disciplineId: uuid("discipline_id")
      .notNull()
      .references(() => disciplines.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.professorId, table.disciplineId] }),
  }),
);

export const professorStudents = pgTable(
  "professor_students",
  {
    professorId: uuid("professor_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.professorId, table.studentId] }),
  }),
);

export const userAnalyses = pgTable("user_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" })
    .unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => universities.id),
  schoolName: text("school_name").notNull(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id),
  courseName: text("course_name").notNull(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id),
  className: text("class_name").notNull(),
  totalUsageTime: integer("total_usage_time").notNull().default(0),
  totalCorrectAnswers: integer("total_correct_answers").notNull().default(0),
  totalWrongAnswers: integer("total_wrong_answers").notNull().default(0),
  subjectCountsQuiz: jsonb("subject_counts_quiz").notNull().default({}),
});

export const analysisSessions = pgTable("analysis_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  analysisId: uuid("analysis_id")
    .notNull()
    .references(() => userAnalyses.id, { onDelete: "cascade" }),
  sessionStart: timestamp("session_start", { withTimezone: true })
    .notNull()
    .defaultNow(),
  sessionEnd: timestamp("session_end", { withTimezone: true }),
  sessionDuration: integer("session_duration").notNull().default(0),
  durationSource: text("duration_source").notNull().default("recorded"),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  totalCorrectAnswers: integer("total_correct_answers").notNull().default(0),
  totalWrongAnswers: integer("total_wrong_answers").notNull().default(0),
  subjectCountsChat: jsonb("subject_counts_chat").notNull().default({}),
}, table => ({
  chronological: check("analysis_sessions_chronological", sql`${table.sessionEnd} IS NULL OR ${table.sessionEnd} >= ${table.sessionStart}`),
  nonnegative: check("analysis_sessions_nonnegative_duration", sql`${table.sessionDuration} >= 0`),
}));

/** Audit trail for explicitly authorised historical repairs; original session values are preserved here. */
export const analysisSessionRecoveries = pgTable("analysis_session_recoveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull(),
  sessionId: uuid("session_id").notNull().references(() => analysisSessions.id),
  previousState: jsonb("previous_state").notNull(),
  evidence: jsonb("evidence").notNull(),
  estimatedEnd: timestamp("estimated_end", { withTimezone: true }).notNull(),
  estimatedDuration: integer("estimated_duration").notNull(),
  backupSha256: text("backup_sha256").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({ sessionUnique: uniqueIndex("analysis_session_recoveries_session_unique").on(table.sessionId) }));

// One live login per account. Shared browser tabs use the same session and activity clock.
export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  analysisSessionId: uuid("analysis_session_id").references(() => analysisSessions.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  lastCheckpointAt: timestamp("last_checkpoint_at", { withTimezone: true }).notNull().defaultNow(),
  idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  endReason: text("end_reason"),
}, table => ({
  liveAccount: uniqueIndex("auth_sessions_live_account").on(table.accountId).where(sql`${table.endedAt} IS NULL`),
  expiry: index("auth_sessions_expiry").on(table.idleExpiresAt, table.expiresAt).where(sql`${table.endedAt} IS NULL`),
}));

export const sessionActivityIntervals = pgTable("session_activity_intervals", {
  id: uuid("id").primaryKey().defaultRandom(),
  authSessionId: uuid("auth_session_id").notNull().references(() => authSessions.id, { onDelete: "cascade" }),
  analysisSessionId: uuid("analysis_session_id").notNull().references(() => analysisSessions.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
}, table => ({
  analysis: index("session_activity_intervals_analysis").on(table.analysisSessionId),
  valid: check("session_activity_intervals_valid", sql`${table.endedAt} > ${table.startedAt} AND ${table.endedAt} <= ${table.startedAt} + interval '60 seconds'`),
}));

export const answerAttempts = pgTable("answer_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => analysisSessions.id, { onDelete: "cascade" }),
  totalCorrectAnswers: integer("total_correct_answers").notNull().default(0),
  totalWrongAnswers: integer("total_wrong_answers").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const answerQuestions = pgTable("answer_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => answerAttempts.id, { onDelete: "cascade" }),
  level: text("level").notNull(),
  subject: text("subject").notNull(),
  question: text("question").notNull(),
  selectedOption: text("selected_option").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  explanation: text("explanation"),
  totalCorrectAnswers: integer("total_correct_answers").notNull().default(0),
  totalWrongAnswers: integer("total_wrong_answers").notNull().default(0),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const performanceBySubject = pgTable(
  "performance_by_subject",
  {
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => userAnalyses.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    correct: integer("correct").notNull().default(0),
    wrong: integer("wrong").notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.analysisId, table.subject] }),
  }),
);

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    title: text("title").notNull().default("Nova Conversa"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userSession: uniqueIndex("chat_sessions_user_session_idx").on(
      table.userId,
      table.sessionId,
    ),
  }),
);

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatSessionId: uuid("chat_session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  detectedTopic: text("detected_topic"),
  metadata: jsonb("metadata").default({}).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chatGenerationJobs = pgTable(
  "chat_generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    chatSessionId: uuid("chat_session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    userMessageId: uuid("user_message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    assistantMessageId: uuid("assistant_message_id").references(
      () => chatMessages.id,
      { onDelete: "set null" },
    ),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    provider: text("provider"),
    outputLanguage: text("output_language").notNull().default("pt-BR"),
    errorCode: text("error_code"),
    errorParams: jsonb("error_params").notNull().default({}),
    retrievedChunks: jsonb("retrieved_chunks").notNull().default([]),
    timingsMs: jsonb("timings_ms").notNull().default({}),
    errorMessage: text("error_message"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    languageCheck: check("chat_jobs_output_language_check", sql`${table.outputLanguage} IN ('pt-BR', 'en-US', 'es-ES')`),
    statusLockedCreatedIdx: index(
      "chat_generation_jobs_status_locked_created_idx",
    ).on(table.status, table.lockedAt, table.createdAt),
    userStatusIdx: index("chat_generation_jobs_user_status_idx").on(
      table.userId,
      table.status,
    ),
    sessionStatusIdx: index("chat_generation_jobs_session_status_idx").on(
      table.chatSessionId,
      table.status,
    ),
  }),
);

export const chatTopicCounts = pgTable(
  "chat_topic_counts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => ({ pk: primaryKey({ columns: [table.userId, table.topic] }) }),
);

export const classRagSettings = pgTable("class_rag_settings", {
  classId: uuid("class_id")
    .primaryKey()
    .references(() => classes.id, { onDelete: "cascade" }),
  ragMode: text("rag_mode").notNull().default("none"),
  topK: integer("top_k").notNull().default(4),
  minScore: integer("min_score").notNull().default(40),
  systemPrompt: text("system_prompt"),
  llmModel: text("llm_model"),
  embeddingModel: text("embedding_model"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ragDocuments = pgTable(
  "rag_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    originalFileName: text("original_file_name").notNull(),
    storedFileName: text("stored_file_name").notNull(),
    filePath: text("file_path").notNull(),
    extractedTextPath: text("extracted_text_path"),
    sourceType: text("source_type").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    status: text("status").notNull().default("uploaded"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    classStatusDeletedIdx: index("rag_documents_class_status_deleted_idx").on(
      table.classId,
      table.status,
      table.deletedAt,
    ),
    uploadedByCreatedIdx: index("rag_documents_uploaded_by_created_idx").on(
      table.uploadedBy,
      table.createdAt,
    ),
  }),
);

// Indice GIN funcional de full-text search (to_tsvector('portuguese', content))
// vive na migration drizzle/0001_rag_chunks_fts.sql, nao aqui — indice
// funcional e uma area fragil pro diffing do drizzle-kit, entao nao e
// declarado no schema.
export const ragDocumentChunks = pgTable(
  "rag_document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => ragDocuments.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull().default(0),
    metadata: jsonb("metadata").notNull().default({}),
    chromaId: text("chroma_id").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    documentChunkIdx: uniqueIndex("rag_document_chunks_document_chunk_idx").on(
      table.documentId,
      table.chunkIndex,
    ),
    classIdx: index("rag_document_chunks_class_idx").on(table.classId),
  }),
);

export const ragIngestionJobs = pgTable(
  "rag_ingestion_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => ragDocuments.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    errorMessage: text("error_message"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusLockedCreatedIdx: index(
      "rag_ingestion_jobs_status_locked_created_idx",
    ).on(table.status, table.lockedAt, table.createdAt),
    documentIdx: index("rag_ingestion_jobs_document_idx").on(
      table.documentId,
    ),
  }),
);

export const quizSessions = pgTable("quiz_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  quizId: text("quiz_id").notNull(),
  title: text("title").notNull().default("Quiz Pratico"),
  completedAt: timestamp("completed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  totalQuestions: integer("total_questions").notNull().default(0),
  score: integer("score").notNull().default(0),
});

export const quizQuestionAttempts = pgTable("quiz_question_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  quizSessionId: uuid("quiz_session_id")
    .notNull()
    .references(() => quizSessions.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  selectedOption: text("selected_option").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  subject: text("subject").notNull(),
  level: text("level"),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const quizSubjectCounts = pgTable(
  "quiz_subject_counts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => ({ pk: primaryKey({ columns: [table.userId, table.subject] }) }),
);

export const professorQuizzes = pgTable(
  "professor_quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professorId: uuid("professor_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    disciplineId: uuid("discipline_id")
      .notNull()
      .references(() => disciplines.id, { onDelete: "cascade" }),
    classId: uuid("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    generationSource: text("generation_source").notNull().default("manual"),
    language: text("language"),
    title: text("title").notNull(),
    topic: text("topic").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    languageCheck: check("professor_quizzes_language_check", sql`${table.language} IS NULL OR ${table.language} IN ('pt-BR', 'en-US', 'es-ES')`),
    idxDisciplineStatusClass: index("idx_pq_discipline_status_class").on(
      table.disciplineId,
      table.status,
      table.classId,
    ),
    idxClassId: index("idx_pq_class_id").on(table.classId),
  }),
);

export const professorQuizQuestions = pgTable("professor_quiz_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => professorQuizzes.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: jsonb("options").notNull().$type<string[]>(),
  correctOption: text("correct_option").notNull(),
  explanation: text("explanation"),
  orderIndex: integer("order_index").notNull().default(0),
});

export const professorQuizAttempts = pgTable("professor_quiz_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => professorQuizzes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  score: integer("score").notNull().default(0),
  totalQuestions: integer("total_questions").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const professorQuizAnswers = pgTable("professor_quiz_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => professorQuizAttempts.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => professorQuizQuestions.id, { onDelete: "cascade" }),
  selectedOption: text("selected_option").notNull(),
  isCorrect: boolean("is_correct").notNull(),
});

export const professorQuizAiGenerations = pgTable(
  "professor_quiz_ai_generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => professorQuizzes.id, { onDelete: "cascade" }),
    professorId: uuid("professor_id")
      .notNull()
      .references(() => accounts.id),
    classId: uuid("class_id").references(() => classes.id),
    disciplineId: uuid("discipline_id")
      .notNull()
      .references(() => disciplines.id),
    theme: text("theme").notNull(),
    questionCount: integer("question_count").notNull(),
    selectedDocumentIds: jsonb("selected_document_ids")
      .notNull()
      .default([])
      .$type<string[]>(),
    retrievedChunkRefs: jsonb("retrieved_chunk_refs")
      .notNull()
      .default([])
      .$type<string[]>(),
    provider: text("provider"),
    model: text("model"),
    language: text("language"),
    status: text("status").notNull().default("done"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    languageCheck: check("quiz_generations_language_check", sql`${table.language} IS NULL OR ${table.language} IN ('pt-BR', 'en-US', 'es-ES')`),
    idxQuizId: index("idx_pqag_quiz_id").on(table.quizId),
  }),
);

export const professorQuizQuestionSources = pgTable(
  "professor_quiz_question_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => professorQuizQuestions.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => ragDocuments.id),
    chromaId: text("chroma_id"),
    chunkIndex: integer("chunk_index"),
    score: integer("score"),
    contentExcerpt: text("content_excerpt"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    idxQuestionId: index("idx_pqqs_question_id").on(table.questionId),
  }),
);

export const feedbacks = pgTable("feedbacks", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("general"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type RoleRow = typeof accountRoles.$inferSelect;
export type StudentProfile = typeof studentProfiles.$inferSelect;
export type ProfessorProfile = typeof professorProfiles.$inferSelect;
export type ClassRagSettings = typeof classRagSettings.$inferSelect;
export type RagDocument = typeof ragDocuments.$inferSelect;
export type RagDocumentChunk = typeof ragDocumentChunks.$inferSelect;
export type RagIngestionJob = typeof ragIngestionJobs.$inferSelect;
export type ChatGenerationJob = typeof chatGenerationJobs.$inferSelect;
export type ProfessorQuiz = typeof professorQuizzes.$inferSelect;
export type ProfessorQuizQuestion = typeof professorQuizQuestions.$inferSelect;
export type ProfessorQuizAttempt = typeof professorQuizAttempts.$inferSelect;
export type ProfessorQuizAiGeneration =
  typeof professorQuizAiGenerations.$inferSelect;
export type ProfessorQuizQuestionSource =
  typeof professorQuizQuestionSources.$inferSelect;

// ── Exercise workbench (practice attempts; Q-matrix concepts) ─────────────────
// One row per "Check" in the workbench. Kept apart from the quiz analytics
// tables so existing dashboard numbers are not affected.
export const exerciseAttempts = pgTable(
  "exercise_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    classId: uuid("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    disciplineId: uuid("discipline_id").references(() => disciplines.id, {
      onDelete: "set null",
    }),
    mode: text("mode").notNull().default("practice"),
    exerciseType: text("exercise_type").notNull(),
    exerciseId: text("exercise_id").notNull(),
    exerciseVersion: integer("exercise_version").notNull().default(1),
    source: text("source").notNull(),
    subject: text("subject").notNull(),
    concepts: jsonb("concepts").notNull().$type<string[]>().default([]),
    attemptNumber: integer("attempt_number").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    hintsUsed: integer("hints_used").notNull().default(0),
    durationMs: integer("duration_ms"),
    engineVersion: text("engine_version").notNull(),
    submittedState: jsonb("submitted_state").notNull(),
    result: jsonb("result").notNull(),
    events: jsonb("events").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    modeCheck: check("exercise_attempts_mode_check", sql`${table.mode} IN ('practice', 'exam')`),
    typeCheck: check("exercise_attempts_type_check", sql`${table.exerciseType} IN ('truth_table', 'translation', 'parsons', 'quiz', 'essay')`),
    sourceCheck: check("exercise_attempts_source_check", sql`${table.source} IN ('catalog', 'custom', 'bank')`),
    attemptNumberCheck: check("exercise_attempts_attempt_number_check", sql`${table.attemptNumber} >= 1`),
    hintsCheck: check("exercise_attempts_hints_check", sql`${table.hintsUsed} >= 0`),
    durationCheck: check("exercise_attempts_duration_check", sql`${table.durationMs} IS NULL OR ${table.durationMs} >= 0`),
    idxStudentExercise: index("idx_exercise_attempts_student_exercise").on(
      table.studentId,
      table.exerciseId,
    ),
    idxClassCreated: index("idx_exercise_attempts_class_created").on(
      table.classId,
      table.createdAt,
    ),
  }),
);

export type ExerciseAttempt = typeof exerciseAttempts.$inferSelect;

// ── Notifications (in-app, optional e-mail) ───────────────────────────────────
// One row per recipient and group: re-publishing does not notify again, and
// progress of a task is a single notification that is updated (and unread again).
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    groupKey: text("group_key").notNull(),
    params: jsonb("params").notNull().$type<Record<string, string | number>>().default({}),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    typeCheck: check("notifications_type_check", sql`${table.type} IN ('quiz_published', 'quiz_completion_progress', 'exam_published', 'exam_submission_progress', 'exam_results_released')`),
    uqRecipientGroup: uniqueIndex("uq_notifications_recipient_group").on(table.recipientId, table.groupKey),
    idxRecipientUpdated: index("idx_notifications_recipient_updated").on(table.recipientId, table.updatedAt),
  }),
);

export const notificationPreferences = pgTable("notification_preferences", {
  accountId: uuid("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;

// ── Question bank (professors) ────────────────────────────────────────────────
// Content is stored normalized (see services/logic/questionCore.ts). "Deleting"
// archives the question, so exams that used it keep their history.
export const assessmentQuestions = pgTable(
  "assessment_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    disciplineId: uuid("discipline_id")
      .notNull()
      .references(() => disciplines.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    version: integer("version").notNull().default(1),
    weight: doublePrecision("weight").notNull().default(1),
    language: text("language").notNull(),
    subject: text("subject"),
    concepts: jsonb("concepts").notNull().$type<string[]>().default([]),
    statement: text("statement").notNull(),
    content: jsonb("content").notNull(),
    sourceQuizQuestionId: uuid("source_quiz_question_id").references(() => professorQuizQuestions.id, {
      onDelete: "set null",
    }),
    /** Also offered in the students' workbench (truth table, translation and Parsons only). */
    practiceEnabled: boolean("practice_enabled").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    typeCheck: check("assessment_questions_type_check", sql`${table.type} IN ('quiz', 'truth_table', 'parsons', 'translation', 'essay')`),
    languageCheck: check("assessment_questions_language_check", sql`${table.language} IN ('pt-BR', 'en-US', 'es-ES')`),
    weightCheck: check("assessment_questions_weight_check", sql`${table.weight} >= 0.5 AND ${table.weight} <= 10`),
    versionCheck: check("assessment_questions_version_check", sql`${table.version} >= 1`),
    idxDisciplineArchived: index("idx_assessment_questions_discipline").on(table.disciplineId, table.archivedAt),
    idxOwnerArchived: index("idx_assessment_questions_owner").on(table.ownerId, table.archivedAt),
    uqImportedQuizQuestion: uniqueIndex("uq_assessment_questions_imported")
      .on(table.ownerId, table.sourceQuizQuestionId)
      .where(sql`${table.archivedAt} IS NULL AND ${table.sourceQuizQuestionId} IS NOT NULL`),
  }),
);

export type AssessmentQuestion = typeof assessmentQuestions.$inferSelect;

// ── Exams (phase 5) ───────────────────────────────────────────────────────────
// Publishing copies each question into exam_questions.snapshot, so later edits in
// the bank never change an exam. Submissions are graded on the server and the
// results stay hidden until the professor releases them (phase 6).
export const exams = pgTable(
  "exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    disciplineId: uuid("discipline_id")
      .notNull()
      .references(() => disciplines.id, { onDelete: "cascade" }),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    instructions: text("instructions"),
    shuffle: boolean("shuffle").notNull().default(false),
    status: text("status").notNull().default("draft"),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    timeLimitMinutes: integer("time_limit_minutes"),
    draftQuestionIds: jsonb("draft_question_ids").notNull().$type<string[]>().default([]),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedBy: uuid("released_by").references(() => accounts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusCheck: check("exams_status_check", sql`${table.status} IN ('draft', 'published', 'closed', 'released')`),
    windowCheck: check("exams_window_check", sql`${table.opensAt} IS NULL OR ${table.closesAt} IS NULL OR ${table.closesAt} > ${table.opensAt}`),
    timeLimitCheck: check("exams_time_limit_check", sql`${table.timeLimitMinutes} IS NULL OR (${table.timeLimitMinutes} >= 1 AND ${table.timeLimitMinutes} <= 600)`),
    idxOwner: index("idx_exams_owner").on(table.ownerId, table.createdAt),
    idxDisciplineStatus: index("idx_exams_discipline_status").on(table.disciplineId, table.status),
  }),
);

export const examQuestions = pgTable(
  "exam_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").references(() => assessmentQuestions.id, { onDelete: "set null" }),
    questionVersion: integer("question_version").notNull(),
    orderIndex: integer("order_index").notNull(),
    type: text("type").notNull(),
    weight: doublePrecision("weight").notNull(),
    snapshot: jsonb("snapshot").notNull(),
  },
  (table) => ({
    uqExamOrder: uniqueIndex("uq_exam_questions_order").on(table.examId, table.orderIndex),
  }),
);

export const examSubmissions = pgTable(
  "exam_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("in_progress"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    lastSavedAt: timestamp("last_saved_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submitReason: text("submit_reason"),
    layout: jsonb("layout").notNull(),
    answers: jsonb("answers").notNull().default({}),
    events: jsonb("events").notNull().default({}),
    objectiveResults: jsonb("objective_results"),
    /** 0–10, written at release (phase 6). */
    grade: doublePrecision("grade"),
  },
  (table) => ({
    statusCheck: check("exam_submissions_status_check", sql`${table.status} IN ('in_progress', 'submitted')`),
    reasonCheck: check("exam_submissions_reason_check", sql`${table.submitReason} IS NULL OR ${table.submitReason} IN ('student', 'time_limit', 'exam_closed')`),
    uqExamStudent: uniqueIndex("uq_exam_submissions_exam_student").on(table.examId, table.studentId),
  }),
);

export type Exam = typeof exams.$inferSelect;
export type ExamQuestion = typeof examQuestions.$inferSelect;
export type ExamSubmission = typeof examSubmissions.$inferSelect;

// ── Blind grading (phase 6) ───────────────────────────────────────────────────
// One row per essay answer. The id and the code are random and unrelated across
// questions, so the grading screen can never link two answers to the same student.
export const blindReviews = pgTable(
  "blind_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => examSubmissions.id, { onDelete: "cascade" }),
    examQuestionId: uuid("exam_question_id")
      .notNull()
      .references(() => examQuestions.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    displayOrder: doublePrecision("display_order").notNull(),
    score: doublePrecision("score"),
    comment: text("comment").notNull().default(""),
    reviewedBy: uuid("reviewed_by").references(() => accounts.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => ({
    scoreCheck: check("blind_reviews_score_check", sql`${table.score} IS NULL OR ${table.score} IN (0, 0.5, 1)`),
    uqQuestionCode: uniqueIndex("uq_blind_reviews_question_code").on(table.examQuestionId, table.code),
    uqSubmissionQuestion: uniqueIndex("uq_blind_reviews_submission_question").on(table.submissionId, table.examQuestionId),
  }),
);

/** Who graded what and when, and who released the results (audit trail). */
export const examAuditLog = pgTable(
  "exam_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => accounts.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetId: uuid("target_id"),
    details: jsonb("details").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    actionCheck: check("exam_audit_log_action_check", sql`${table.action} IN ('review', 'release')`),
    idxExam: index("idx_exam_audit_log_exam").on(table.examId, table.createdAt),
  }),
);

export type BlindReview = typeof blindReviews.$inferSelect;

/** 👍 / mais ou menos / 👎 given by the person who asked, on an assistant answer of their own conversation. */
export const chatMessageFeedback = pgTable(
  "chat_message_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    rating: text("rating").notNull(),
    reason: text("reason"),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    ratingCheck: check("chat_message_feedback_rating_check", sql`${table.rating} IN ('up', 'partial', 'down')`),
    reasonCheck: check("chat_message_feedback_reason_check", sql`${table.reason} IS NULL OR ${table.reason} IN ('incorrect', 'incomplete', 'unclear', 'off_topic', 'other')`),
    uqMessageAccount: uniqueIndex("uq_chat_message_feedback_message_account").on(table.messageId, table.accountId),
    idxCreated: index("idx_chat_message_feedback_created").on(table.createdAt),
  }),
);

/**
 * Release of a feature for a scope. The most specific rule wins (class > course > institution > global);
 * without any rule a feature is released, so existing behaviour does not change.
 */
export const featureRules = pgTable(
  "feature_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feature: text("feature").notNull(),
    scope: text("scope").notNull(),
    /** Institution, course or class id; empty for the global rule. */
    scopeId: text("scope_id").notNull().default(""),
    enabled: boolean("enabled").notNull(),
    updatedBy: uuid("updated_by").references(() => accounts.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    scopeCheck: check("feature_rules_scope_check", sql`${table.scope} IN ('global', 'institution', 'course', 'class')`),
    uqRule: uniqueIndex("uq_feature_rules_feature_scope").on(table.feature, table.scope, table.scopeId),
  }),
);

/**
 * Hints given in the workbench (up to 3 per exercise and student, never during an exam).
 * The unique index keeps the limit even when two requests arrive at the same time.
 */
export const exerciseHints = pgTable(
  "exercise_hints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => exerciseAttempts.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").notNull(),
    level: integer("level").notNull(),
    /** "ai" when written by the model, "fallback" for the built-in text. */
    source: text("source").notNull(),
    usedMaterial: boolean("used_material").notNull().default(false),
    text: text("text").notNull(),
    language: text("language").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    levelCheck: check("exercise_hints_level_check", sql`${table.level} BETWEEN 1 AND 3`),
    sourceCheck: check("exercise_hints_source_check", sql`${table.source} IN ('ai', 'fallback')`),
    uniqueLevel: uniqueIndex("uq_exercise_hints_student_exercise_level").on(table.studentId, table.exerciseId, table.level),
    byStudentTime: index("idx_exercise_hints_student_created").on(table.studentId, table.createdAt),
  }),
);

/**
 * Public profile of an institution (page "Instituição"): every field is optional except the status.
 * Kept apart from `universities`, so the existing table does not change. Images are stored as
 * small data URLs (size checked on upload). A deactivated institution keeps all its data.
 */
export const institutionProfiles = pgTable("institution_profiles", {
  universityId: uuid("university_id")
    .primaryKey()
    .references(() => universities.id, { onDelete: "cascade" }),
  kind: text("kind"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  address: text("address"),
  addressNumber: text("address_number"),
  district: text("district"),
  postalCode: text("postal_code"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  website: text("website"),
  /** Optional social networks and other sites: [{ kind, url }]. */
  links: jsonb("links").$type<Array<{ kind: string; url: string }>>(),
  about: text("about"),
  logo: text("logo"),
  cover: text("cover"),
  active: boolean("active").notNull().default(true),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  deactivatedBy: uuid("deactivated_by").references(() => accounts.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Flash cards: decks made by the staff for a subject; students of the classes that have the subject
 * study the published ones. Each student keeps their own spaced-repetition box per card.
 */
export const flashcardDecks = pgTable(
  "flashcard_decks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    disciplineId: uuid("discipline_id")
      .notNull()
      .references(() => disciplines.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    language: text("language").notNull().default("pt-BR"),
    published: boolean("published").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byDiscipline: index("idx_flashcard_decks_discipline").on(table.disciplineId),
  }),
);

export const flashcards = pgTable(
  "flashcards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => flashcardDecks.id, { onDelete: "cascade" }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    concept: text("concept"),
    position: integer("position").notNull().default(0),
    sourceQuestionId: uuid("source_question_id").references(() => assessmentQuestions.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byDeck: index("idx_flashcards_deck").on(table.deckId, table.position),
  }),
);

export const flashcardReviews = pgTable(
  "flashcard_reviews",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => flashcards.id, { onDelete: "cascade" }),
    /** Leitner box 1 (review soon) to 5 (well known). */
    box: integer("box").notNull().default(1),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    lastRating: text("last_rating"),
    reviews: integer("reviews").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.studentId, table.cardId] }),
    byStudentDue: index("idx_flashcard_reviews_student_due").on(table.studentId, table.dueAt),
  }),
);

/**
 * Ranking rules set by the owner: one row for the whole platform ("global", scope_id '') and optional
 * rows per institution that override part of it. `config` holds period, weights and who may see it.
 */
export const rankingSettings = pgTable(
  "ranking_settings",
  {
    scope: text("scope").notNull(),
    scopeId: text("scope_id").notNull().default(""),
    config: jsonb("config").notNull().$type<Record<string, unknown>>(),
    updatedBy: uuid("updated_by").references(() => accounts.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.scope, table.scopeId] }),
    scopeCheck: check("ranking_settings_scope_check", sql`${table.scope} IN ('global', 'institution')`),
  }),
);
