import {
  boolean,
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
});

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
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  totalCorrectAnswers: integer("total_correct_answers").notNull().default(0),
  totalWrongAnswers: integer("total_wrong_answers").notNull().default(0),
  subjectCountsChat: jsonb("subject_counts_chat").notNull().default({}),
});

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

// Vinculo entre um documento ja processado e uma turma que pode usa-lo na
// recuperacao do chat, independente da turma "dona" (rag_documents.class_id,
// onde o arquivo foi originalmente enviado). Permite reaproveitar o mesmo
// documento (ja extraido/chunkeado/embeddado) em varias turmas sem reprocessar.
export const ragDocumentClasses = pgTable(
  "rag_document_classes",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => ragDocuments.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.documentId, table.classId] }),
    classIdx: index("rag_document_classes_class_idx").on(table.classId),
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
    status: text("status").notNull().default("done"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
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
