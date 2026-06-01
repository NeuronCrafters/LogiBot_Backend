import {
  boolean,
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
  resetPasswordExpires: timestamp("reset_password_expires", { withTimezone: true }),
  lastFeedbackAt: timestamp("last_feedback_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountRoles = pgTable("account_roles", {
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.accountId, table.role] }),
}));

export const universities = pgTable("universities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  universityId: uuid("university_id").notNull().references(() => universities.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueNameByUniversity: uniqueIndex("courses_name_university_idx").on(table.name, table.universityId),
}));

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueNameByCourse: uniqueIndex("classes_name_course_idx").on(table.name, table.courseId),
}));

export const disciplines = pgTable("disciplines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueNameByCourse: uniqueIndex("disciplines_name_course_idx").on(table.name, table.courseId),
}));

export const studentProfiles = pgTable("student_profiles", {
  accountId: uuid("account_id").primaryKey().references(() => accounts.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => universities.id),
  courseId: uuid("course_id").notNull().references(() => courses.id),
  classId: uuid("class_id").notNull().references(() => classes.id),
  level: text("level").notNull().default("desconhecido"),
});

export const professorProfiles = pgTable("professor_profiles", {
  accountId: uuid("account_id").primaryKey().references(() => accounts.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => universities.id),
});

export const passwordHistory = pgTable("password_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  hash: text("hash").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentDisciplines = pgTable("student_disciplines", {
  studentId: uuid("student_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  disciplineId: uuid("discipline_id").notNull().references(() => disciplines.id, { onDelete: "cascade" }),
}, (table) => ({ pk: primaryKey({ columns: [table.studentId, table.disciplineId] }) }));

export const classDisciplines = pgTable("class_disciplines", {
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  disciplineId: uuid("discipline_id").notNull().references(() => disciplines.id, { onDelete: "cascade" }),
}, (table) => ({ pk: primaryKey({ columns: [table.classId, table.disciplineId] }) }));

export const professorCourses = pgTable("professor_courses", {
  professorId: uuid("professor_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
}, (table) => ({ pk: primaryKey({ columns: [table.professorId, table.courseId] }) }));

export const professorClasses = pgTable("professor_classes", {
  professorId: uuid("professor_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
}, (table) => ({ pk: primaryKey({ columns: [table.professorId, table.classId] }) }));

export const professorDisciplines = pgTable("professor_disciplines", {
  professorId: uuid("professor_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  disciplineId: uuid("discipline_id").notNull().references(() => disciplines.id, { onDelete: "cascade" }),
}, (table) => ({ pk: primaryKey({ columns: [table.professorId, table.disciplineId] }) }));

export const professorStudents = pgTable("professor_students", {
  professorId: uuid("professor_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
}, (table) => ({ pk: primaryKey({ columns: [table.professorId, table.studentId] }) }));

export const userAnalyses = pgTable("user_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => accounts.id, { onDelete: "cascade" }).unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  schoolId: uuid("school_id").notNull().references(() => universities.id),
  schoolName: text("school_name").notNull(),
  courseId: uuid("course_id").notNull().references(() => courses.id),
  courseName: text("course_name").notNull(),
  classId: uuid("class_id").notNull().references(() => classes.id),
  className: text("class_name").notNull(),
  totalUsageTime: integer("total_usage_time").notNull().default(0),
  totalCorrectAnswers: integer("total_correct_answers").notNull().default(0),
  totalWrongAnswers: integer("total_wrong_answers").notNull().default(0),
  subjectCountsQuiz: jsonb("subject_counts_quiz").notNull().default({}),
});

export const analysisSessions = pgTable("analysis_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  analysisId: uuid("analysis_id").notNull().references(() => userAnalyses.id, { onDelete: "cascade" }),
  sessionStart: timestamp("session_start", { withTimezone: true }).notNull().defaultNow(),
  sessionEnd: timestamp("session_end", { withTimezone: true }),
  sessionDuration: integer("session_duration").notNull().default(0),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  totalCorrectAnswers: integer("total_correct_answers").notNull().default(0),
  totalWrongAnswers: integer("total_wrong_answers").notNull().default(0),
  subjectCountsChat: jsonb("subject_counts_chat").notNull().default({}),
});

export const answerAttempts = pgTable("answer_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => analysisSessions.id, { onDelete: "cascade" }),
  totalCorrectAnswers: integer("total_correct_answers").notNull().default(0),
  totalWrongAnswers: integer("total_wrong_answers").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const answerQuestions = pgTable("answer_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id").notNull().references(() => answerAttempts.id, { onDelete: "cascade" }),
  level: text("level").notNull(),
  subject: text("subject").notNull(),
  question: text("question").notNull(),
  selectedOption: text("selected_option").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  explanation: text("explanation"),
  totalCorrectAnswers: integer("total_correct_answers").notNull().default(0),
  totalWrongAnswers: integer("total_wrong_answers").notNull().default(0),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const performanceBySubject = pgTable("performance_by_subject", {
  analysisId: uuid("analysis_id").notNull().references(() => userAnalyses.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  correct: integer("correct").notNull().default(0),
  wrong: integer("wrong").notNull().default(0),
}, (table) => ({ pk: primaryKey({ columns: [table.analysisId, table.subject] }) }));

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  title: text("title").notNull().default("Nova Conversa"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ userSession: uniqueIndex("chat_sessions_user_session_idx").on(table.userId, table.sessionId) }));

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatSessionId: uuid("chat_session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  detectedTopic: text("detected_topic"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const chatTopicCounts = pgTable("chat_topic_counts", {
  userId: uuid("user_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  count: integer("count").notNull().default(0),
}, (table) => ({ pk: primaryKey({ columns: [table.userId, table.topic] }) }));

export const quizSessions = pgTable("quiz_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  quizId: text("quiz_id").notNull(),
  title: text("title").notNull().default("Quiz Pratico"),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  totalQuestions: integer("total_questions").notNull().default(0),
  score: integer("score").notNull().default(0),
});

export const quizQuestionAttempts = pgTable("quiz_question_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  quizSessionId: uuid("quiz_session_id").notNull().references(() => quizSessions.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  selectedOption: text("selected_option").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  subject: text("subject").notNull(),
  level: text("level"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const quizSubjectCounts = pgTable("quiz_subject_counts", {
  userId: uuid("user_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  count: integer("count").notNull().default(0),
}, (table) => ({ pk: primaryKey({ columns: [table.userId, table.subject] }) }));

export type Account = typeof accounts.$inferSelect;
export type RoleRow = typeof accountRoles.$inferSelect;
export type StudentProfile = typeof studentProfiles.$inferSelect;
export type ProfessorProfile = typeof professorProfiles.$inferSelect;
