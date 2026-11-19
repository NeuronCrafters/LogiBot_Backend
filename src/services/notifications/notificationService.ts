import { and, count, countDistinct, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import {
  accounts,
  classDisciplines,
  disciplines,
  examSubmissions,
  exams,
  notificationPreferences,
  notifications,
  professorQuizAttempts,
  professorQuizzes,
  studentProfiles,
} from "../../db/schema";
import { normalizeLanguage, t, withLanguage, type Language, type MessageKey } from "../../i18n";
import { logger } from "../../logger";
import { sendMail } from "../email/mailService";
import { featureEnabledForAccount } from "../features/featureService";

const SCOPE = "Notifications";
export const NOTIFICATION_TYPES = ["quiz_published", "quiz_completion_progress", "exam_published", "exam_submission_progress", "exam_results_released"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const MAX_NOTIFICATIONS_PAGE = 50;

type Params = Record<string, string | number>;
interface Recipient { id: string; name: string; email: string; preferredLanguage: string | null }

/** Students who can see a quiz: its class, or every class linked to its discipline. */
export async function quizAudience(db: AnyDbClient, quiz: { classId: string | null; disciplineId: string }): Promise<string[]> {
  const classIds = quiz.classId
    ? [quiz.classId]
    : (await db.select({ classId: classDisciplines.classId }).from(classDisciplines).where(eq(classDisciplines.disciplineId, quiz.disciplineId)))
      .map((row) => row.classId);
  if (classIds.length === 0) return [];
  const rows = await db
    .select({ id: studentProfiles.accountId })
    .from(studentProfiles)
    .innerJoin(accounts, eq(accounts.id, studentProfiles.accountId))
    .where(and(inArray(studentProfiles.classId, classIds), eq(accounts.status, "active")));
  return rows.map((row) => row.id);
}

async function loadQuiz(db: AnyDbClient, quizId: string) {
  const [quiz] = await db
    .select({
      id: professorQuizzes.id,
      title: professorQuizzes.title,
      status: professorQuizzes.status,
      professorId: professorQuizzes.professorId,
      classId: professorQuizzes.classId,
      disciplineId: professorQuizzes.disciplineId,
      disciplineName: disciplines.name,
    })
    .from(professorQuizzes)
    .innerJoin(disciplines, eq(disciplines.id, professorQuizzes.disciplineId))
    .where(eq(professorQuizzes.id, quizId))
    .limit(1);
  return quiz;
}

/** Recipients among `ids` who turned e-mail on. */
async function emailRecipients(db: AnyDbClient, ids: string[]): Promise<Recipient[]> {
  if (ids.length === 0) return [];
  return db
    .select({ id: accounts.id, name: accounts.name, email: accounts.email, preferredLanguage: accounts.preferredLanguage })
    .from(accounts)
    .innerJoin(notificationPreferences, eq(notificationPreferences.accountId, accounts.id))
    .where(and(inArray(accounts.id, ids), eq(notificationPreferences.emailEnabled, true)));
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] as string);

const EMAIL_KEYS: Record<NotificationType, { subject: MessageKey; body: MessageKey }> = {
  quiz_published: { subject: "notifications.email.quizPublishedSubject", body: "notifications.email.quizPublishedBody" },
  quiz_completion_progress: { subject: "notifications.email.quizProgressSubject", body: "notifications.email.quizProgressBody" },
  exam_published: { subject: "notifications.email.examPublishedSubject", body: "notifications.email.examPublishedBody" },
  exam_submission_progress: { subject: "notifications.email.examProgressSubject", body: "notifications.email.examProgressBody" },
  exam_results_released: { subject: "notifications.email.examResultsSubject", body: "notifications.email.examResultsBody" },
};

/** Builds the e-mail in the recipient's language. Exported for tests. */
export function buildNotificationEmail(recipient: Recipient, type: NotificationType, params: Params, url: string) {
  const language: Language = normalizeLanguage(recipient.preferredLanguage) || "pt-BR";
  return withLanguage(language, () => {
    const keys = EMAIL_KEYS[type];
    const escaped: Params = {};
    Object.keys(params).forEach((key) => { escaped[key] = typeof params[key] === "string" ? escapeHtml(params[key] as string) : params[key]; });
    const subject = t(keys.subject, params);
    const body = t(keys.body, params);
    return {
      to: recipient.email,
      subject,
      text: [t("email.greeting", { name: recipient.name }), body, `${t("notifications.email.open")}: ${url}`, t("notifications.email.footer")].join("\n\n"),
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <p>${t("email.greeting", { name: escapeHtml(recipient.name) })}</p>
        <p>${t(keys.body, escaped)}</p>
        <p><a href="${escapeHtml(url)}" style="display: inline-block; padding: 10px 16px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;">${t("notifications.email.open")}</a></p>
        <p style="font-size: 12px; color: #6b7280;">${t("notifications.email.footer")}</p>
      </div>`,
    };
  });
}

/** E-mail is best effort: a missing SMTP setup or a failure never breaks the request. */
async function deliverEmails(db: AnyDbClient, ids: string[], type: NotificationType, params: Params, url: string) {
  const recipients = await emailRecipients(db, ids);
  for (const recipient of recipients) {
    try {
      // E-mail can be blocked by the admin apart from the in-app notifications.
      if (!(await featureEnabledForAccount(db, recipient.id, "notifications_email"))) continue;
      await sendMail(buildNotificationEmail(recipient, type, params, url));
    } catch (error) {
      logger.warn(SCOPE, "Notification e-mail not sent.", { type, message: error instanceof Error ? error.message : String(error) });
    }
  }
}

const absolute = (appUrl: string, link: string) => `${appUrl.replace(/\/$/, "")}${link}`;

export interface NotifyResult { recipients: string[]; emails: Promise<void> }

/** Notifies the quiz audience once per quiz (re-publishing does not notify again). */
export async function notifyQuizPublished(db: AnyDbClient, quizId: string, appUrl: string): Promise<NotifyResult> {
  const quiz = await loadQuiz(db, quizId);
  if (!quiz || quiz.status !== "published") return { recipients: [], emails: Promise.resolve() };
  const audience = await quizAudience(db, quiz);
  if (audience.length === 0) return { recipients: [], emails: Promise.resolve() };
  const params: Params = { quizId: quiz.id, quizTitle: quiz.title, disciplineName: quiz.disciplineName };
  const link = `/quiz/${quiz.id}`;
  const created = await db
    .insert(notifications)
    .values(audience.map((recipientId) => ({ recipientId, type: "quiz_published", groupKey: `quiz_published:${quiz.id}`, params, link })))
    .onConflictDoNothing({ target: [notifications.recipientId, notifications.groupKey] })
    .returning({ recipientId: notifications.recipientId });
  const recipients = created.map((row) => row.recipientId);
  return { recipients, emails: deliverEmails(db, recipients, "quiz_published", params, absolute(appUrl, link)) };
}

/**
 * Updates the professor's single progress notification for a quiz when a student
 * completes it for the first time. Later attempts of the same student do not count.
 */
export async function notifyQuizCompletion(db: AnyDbClient, quizId: string, studentId: string, appUrl: string): Promise<NotifyResult> {
  const none = { recipients: [], emails: Promise.resolve() };
  const quiz = await loadQuiz(db, quizId);
  if (!quiz) return none;
  const [own] = await db
    .select({ total: count() })
    .from(professorQuizAttempts)
    .where(and(eq(professorQuizAttempts.quizId, quizId), eq(professorQuizAttempts.studentId, studentId)));
  if (Number(own ? own.total : 0) !== 1) return none;

  const [done] = await db
    .select({ total: countDistinct(professorQuizAttempts.studentId) })
    .from(professorQuizAttempts)
    .where(eq(professorQuizAttempts.quizId, quizId));
  const completed = Number(done ? done.total : 0);
  const total = Math.max(completed, (await quizAudience(db, quiz)).length);
  const [student] = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, studentId)).limit(1);
  const params: Params = { quizId: quiz.id, quizTitle: quiz.title, disciplineName: quiz.disciplineName, completed, total, lastStudentName: student ? student.name : "" };
  const link = "/quiz/manage";
  const now = new Date();

  await db
    .insert(notifications)
    .values({ recipientId: quiz.professorId, type: "quiz_completion_progress", groupKey: `quiz_completion:${quiz.id}`, params, link })
    .onConflictDoUpdate({
      target: [notifications.recipientId, notifications.groupKey],
      set: { params, readAt: null, updatedAt: now },
    });
  // E-mail only at milestones (first and last completion), not for every student.
  const milestone = completed === 1 || completed === total;
  const recipients = [quiz.professorId];
  return { recipients, emails: milestone ? deliverEmails(db, recipients, "quiz_completion_progress", params, absolute(appUrl, link)) : Promise.resolve() };
}

/* ── Exams ─────────────────────────────────────────────────────────────── */

async function loadExam(db: AnyDbClient, examId: string) {
  const [exam] = await db
    .select({
      id: exams.id,
      title: exams.title,
      status: exams.status,
      ownerId: exams.ownerId,
      classId: exams.classId,
      disciplineId: exams.disciplineId,
      disciplineName: disciplines.name,
    })
    .from(exams)
    .innerJoin(disciplines, eq(disciplines.id, exams.disciplineId))
    .where(eq(exams.id, examId))
    .limit(1);
  return exam;
}

/** Tells the class that an exam was published (once per exam). */
export async function notifyExamPublished(db: AnyDbClient, examId: string, appUrl: string): Promise<NotifyResult> {
  const exam = await loadExam(db, examId);
  if (!exam || exam.status !== "published") return { recipients: [], emails: Promise.resolve() };
  const audience = await quizAudience(db, exam);
  if (audience.length === 0) return { recipients: [], emails: Promise.resolve() };
  const params: Params = { examId: exam.id, examTitle: exam.title, disciplineName: exam.disciplineName };
  const link = `/exams/${exam.id}`;
  const created = await db
    .insert(notifications)
    .values(audience.map((recipientId) => ({ recipientId, type: "exam_published", groupKey: `exam_published:${exam.id}`, params, link })))
    .onConflictDoNothing({ target: [notifications.recipientId, notifications.groupKey] })
    .returning({ recipientId: notifications.recipientId });
  const recipients = created.map((row) => row.recipientId);
  return { recipients, emails: deliverEmails(db, recipients, "exam_published", params, absolute(appUrl, link)) };
}

/** Keeps one "X of Y submitted" notification per exam for its professor. */
export async function notifyExamSubmission(db: AnyDbClient, examId: string, studentId: string, appUrl: string): Promise<NotifyResult> {
  const exam = await loadExam(db, examId);
  if (!exam) return { recipients: [], emails: Promise.resolve() };
  const [done] = await db
    .select({ total: count() })
    .from(examSubmissions)
    .where(and(eq(examSubmissions.examId, examId), eq(examSubmissions.status, "submitted")));
  const submitted = Number(done ? done.total : 0);
  const total = Math.max(submitted, (await quizAudience(db, exam)).length);
  const [student] = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, studentId)).limit(1);
  const params: Params = { examId: exam.id, examTitle: exam.title, disciplineName: exam.disciplineName, submitted, total, lastStudentName: student ? student.name : "" };
  const link = `/exams/manage/${exam.id}`;
  await db
    .insert(notifications)
    .values({ recipientId: exam.ownerId, type: "exam_submission_progress", groupKey: `exam_submission:${exam.id}`, params, link })
    .onConflictDoUpdate({ target: [notifications.recipientId, notifications.groupKey], set: { params, readAt: null, updatedAt: new Date() } });
  const milestone = submitted === 1 || submitted === total;
  const recipients = [exam.ownerId];
  return { recipients, emails: milestone ? deliverEmails(db, recipients, "exam_submission_progress", params, absolute(appUrl, link)) : Promise.resolve() };
}

/** Tells each student who submitted that the grade is available (once per exam). */
export async function notifyExamResults(db: AnyDbClient, examId: string, studentIds: string[], appUrl: string): Promise<NotifyResult> {
  const exam = await loadExam(db, examId);
  if (!exam || !studentIds.length) return { recipients: [], emails: Promise.resolve() };
  const params: Params = { examId: exam.id, examTitle: exam.title, disciplineName: exam.disciplineName };
  const link = `/exams/${exam.id}`;
  const created = await db
    .insert(notifications)
    .values(studentIds.map((recipientId) => ({ recipientId, type: "exam_results_released", groupKey: `exam_results:${exam.id}`, params, link })))
    .onConflictDoNothing({ target: [notifications.recipientId, notifications.groupKey] })
    .returning({ recipientId: notifications.recipientId });
  const recipients = created.map((row) => row.recipientId);
  return { recipients, emails: deliverEmails(db, recipients, "exam_results_released", params, absolute(appUrl, link)) };
}

/** Wrapper for hooks inside existing flows: notifications must never break publishing or answering. */
export async function notifySafely(label: string, run: () => Promise<NotifyResult>): Promise<void> {
  try {
    const result = await run();
    void result.emails.catch((error) => logger.warn(SCOPE, "Notification e-mails failed.", { label, message: String(error) }));
  } catch (error) {
    logger.error(SCOPE, "Notification not created.", { label, message: error instanceof Error ? error.message : String(error) });
  }
}

/* ── Reading and preferences ───────────────────────────────────────────── */

export async function listNotifications(db: AnyDbClient, accountId: string, limit = 30) {
  const size = Math.max(1, Math.min(MAX_NOTIFICATIONS_PAGE, Math.floor(limit) || 30));
  const items = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      params: notifications.params,
      link: notifications.link,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      updatedAt: notifications.updatedAt,
    })
    .from(notifications)
    .where(eq(notifications.recipientId, accountId))
    .orderBy(desc(notifications.updatedAt))
    .limit(size);
  const [unread] = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientId, accountId), isNull(notifications.readAt)));
  return { items, unreadCount: Number(unread ? unread.total : 0) };
}

export async function markNotificationRead(db: AnyDbClient, accountId: string, id: string): Promise<boolean> {
  const updated = await db
    .update(notifications)
    .set({ readAt: sql`COALESCE(${notifications.readAt}, now())` })
    .where(and(eq(notifications.id, id), eq(notifications.recipientId, accountId)))
    .returning({ id: notifications.id });
  return updated.length > 0;
}

export async function markAllNotificationsRead(db: AnyDbClient, accountId: string): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.recipientId, accountId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return updated.length;
}

export async function getNotificationPreferences(db: AnyDbClient, accountId: string) {
  const [row] = await db
    .select({ emailEnabled: notificationPreferences.emailEnabled })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.accountId, accountId))
    .limit(1);
  return { emailEnabled: row ? row.emailEnabled : false };
}

export async function setNotificationPreferences(db: AnyDbClient, accountId: string, emailEnabled: boolean) {
  const now = new Date();
  await db
    .insert(notificationPreferences)
    .values({ accountId, emailEnabled, updatedAt: now })
    .onConflictDoUpdate({ target: notificationPreferences.accountId, set: { emailEnabled, updatedAt: now } });
  return { emailEnabled };
}
