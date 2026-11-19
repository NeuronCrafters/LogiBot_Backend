import { and, count, desc, eq, gte, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { accountRoles, chatMessageFeedback, chatMessages, chatSessions, courses, professorProfiles, studentProfiles } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { activeChatMessage } from "./chatService";

export const CHAT_FEEDBACK_REASONS = ["incorrect", "incomplete", "unclear", "off_topic", "other"] as const;
export const MAX_FEEDBACK_COMMENT = 500;
/** Groups smaller than this are hidden in the summary, so nobody is identified indirectly. */
export const MIN_GROUP_SIZE = 5;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FeedbackInput {
  rating: "up" | "partial" | "down";
  reason: (typeof CHAT_FEEDBACK_REASONS)[number] | null;
  comment: string | null;
}

/** Validates the body: a reason and a comment only make sense when the answer was not fully useful. */
export function parseFeedback(body: unknown): FeedbackInput {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (value.rating !== "up" && value.rating !== "partial" && value.rating !== "down") throw new AppError("chatFeedback.ratingInvalid", 400);
  if (value.rating === "up") return { rating: "up", reason: null, comment: null };
  let reason: FeedbackInput["reason"] = null;
  if (value.reason !== undefined && value.reason !== null && value.reason !== "") {
    if ((CHAT_FEEDBACK_REASONS as readonly unknown[]).indexOf(value.reason) === -1) throw new AppError("chatFeedback.reasonInvalid", 400);
    reason = value.reason as FeedbackInput["reason"];
  }
  let comment: string | null = null;
  if (value.comment !== undefined && value.comment !== null) {
    if (typeof value.comment !== "string") throw new AppError("chatFeedback.commentInvalid", 400);
    const trimmed = value.comment.trim();
    if (trimmed.length > MAX_FEEDBACK_COMMENT) throw new AppError({ key: "chatFeedback.commentTooLong", params: { max: MAX_FEEDBACK_COMMENT } }, 400);
    comment = trimmed || null;
  }
  return { rating: value.rating, reason, comment };
}

/** The message must be an active assistant answer in a conversation of this account. */
async function ownAssistantMessage(db: AnyDbClient, accountId: string, messageId: string) {
  if (!UUID.test(messageId)) throw new AppError("chatFeedback.messageNotFound", 404);
  const [row] = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .innerJoin(chatSessions, eq(chatSessions.id, chatMessages.chatSessionId))
    .where(and(eq(chatMessages.id, messageId), eq(chatSessions.userId, accountId), eq(chatMessages.role, "assistant"), activeChatMessage))
    .limit(1);
  if (!row) throw new AppError("chatFeedback.messageNotFound", 404);
  return row.id;
}

/** A rating is final: it is stored once and never changed or removed by the person. */
export async function saveFeedback(db: AnyDbClient, accountId: string, messageId: string, body: unknown) {
  const input = parseFeedback(body);
  const id = await ownAssistantMessage(db, accountId, messageId);
  const [saved] = await db
    .insert(chatMessageFeedback)
    .values({ messageId: id, accountId, ...input })
    .onConflictDoNothing({ target: [chatMessageFeedback.messageId, chatMessageFeedback.accountId] })
    .returning({ messageId: chatMessageFeedback.messageId, rating: chatMessageFeedback.rating, reason: chatMessageFeedback.reason, comment: chatMessageFeedback.comment });
  if (!saved) throw new AppError("chatFeedback.alreadyRated", 409);
  return saved;
}

/** Ratings the account gave in one of its conversations (to restore the buttons). */
export async function listSessionFeedback(db: AnyDbClient, accountId: string, sessionId: string) {
  return db
    .select({ messageId: chatMessageFeedback.messageId, rating: chatMessageFeedback.rating, reason: chatMessageFeedback.reason, comment: chatMessageFeedback.comment })
    .from(chatMessageFeedback)
    .innerJoin(chatMessages, eq(chatMessages.id, chatMessageFeedback.messageId))
    .innerJoin(chatSessions, eq(chatSessions.id, chatMessages.chatSessionId))
    .where(and(eq(chatSessions.userId, accountId), eq(chatSessions.sessionId, sessionId), eq(chatMessageFeedback.accountId, accountId)));
}

/* ── Admin summary (aggregated, never by person) ─────────────────────────── */

interface Bucket { key: string; up: number; partial: number; down: number; total: number; score: number | null }

/** Satisfaction from 0 to 1: useful = 1, more or less = 0.5, not useful = 0. */
export const satisfaction = (up: number, partial: number, total: number) => (total ? (up + partial / 2) / total : null);

function bucketize(rows: Array<{ key: string | null; rating: string }>, minSize: number) {
  const map: Record<string, { up: number; partial: number; down: number }> = {};
  for (const row of rows) {
    const key = row.key || "unknown";
    if (!map[key]) map[key] = { up: 0, partial: 0, down: 0 };
    if (row.rating === "up") map[key].up++;
    else if (row.rating === "partial") map[key].partial++;
    else map[key].down++;
  }
  const visible: Bucket[] = [];
  let hidden = 0;
  for (const key of Object.keys(map)) {
    const { up, partial, down } = map[key];
    const total = up + partial + down;
    if (total < minSize) { hidden += total; continue; }
    visible.push({ key, up, partial, down, total, score: satisfaction(up, partial, total) });
  }
  visible.sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  return { groups: visible, hidden };
}

const ROLE_ORDER = ["admin", "course-coordinator", "professor", "student"];
/** One profile per account: the highest role it has. */
export function mainRole(roles: string[]): string {
  for (const role of ROLE_ORDER) if (roles.indexOf(role) !== -1) return role;
  return roles[0] ?? "unknown";
}

export interface SummaryFilters { days?: unknown; institutionId?: unknown; courseId?: unknown; classId?: unknown }

/**
 * Institution covers students and professors of it; course and class follow the student profile.
 * Invalid ids are rejected so a typo never silently shows the whole platform.
 */
export function summaryConditions(filters: SummaryFilters): SQL[] {
  const conditions: SQL[] = [];
  const id = (value: unknown) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || !UUID.test(value)) throw new AppError("chatFeedback.filterInvalid", 400);
    return value;
  };
  const institutionId = id(filters.institutionId);
  const courseId = id(filters.courseId);
  const classId = id(filters.classId);
  if (institutionId) conditions.push(or(eq(studentProfiles.schoolId, institutionId), eq(professorProfiles.schoolId, institutionId)) as SQL);
  if (courseId) conditions.push(eq(studentProfiles.courseId, courseId));
  if (classId) conditions.push(eq(studentProfiles.classId, classId));
  return conditions;
}

export async function feedbackSummary(db: AnyDbClient, options: SummaryFilters) {
  const days = Math.min(365, Math.max(1, Number(options.days) || 30));
  const since = new Date(Date.now() - days * 86400000);
  const filters = summaryConditions(options);
  const rows = await db
    .select({
      accountId: chatMessageFeedback.accountId,
      rating: chatMessageFeedback.rating,
      reason: chatMessageFeedback.reason,
      comment: chatMessageFeedback.comment,
      createdAt: chatMessageFeedback.updatedAt,
      topic: chatMessages.detectedTopic,
      language: sql<string | null>`${chatMessages.metadata}->>'outputLanguage'`,
      answer: chatMessages.content,
      chatSessionId: chatMessages.chatSessionId,
      answeredAt: chatMessages.timestamp,
      courseName: courses.name,
    })
    .from(chatMessageFeedback)
    .innerJoin(chatMessages, eq(chatMessages.id, chatMessageFeedback.messageId))
    .leftJoin(studentProfiles, eq(studentProfiles.accountId, chatMessageFeedback.accountId))
    .leftJoin(courses, eq(courses.id, studentProfiles.courseId))
    .leftJoin(professorProfiles, eq(professorProfiles.accountId, chatMessageFeedback.accountId))
    .where(and(gte(chatMessageFeedback.updatedAt, since), ...filters))
    .orderBy(desc(chatMessageFeedback.updatedAt));

  const accountIds = rows.map((row) => row.accountId).filter((id, index, all) => all.indexOf(id) === index);
  const roleRows = accountIds.length
    ? await db.select({ accountId: accountRoles.accountId, role: accountRoles.role }).from(accountRoles).where(inArray(accountRoles.accountId, accountIds))
    : [];
  const rolesOf: Record<string, string[]> = {};
  for (const row of roleRows) (rolesOf[row.accountId] = rolesOf[row.accountId] || []).push(row.role);

  const up = rows.filter((row) => row.rating === "up").length;
  const partial = rows.filter((row) => row.rating === "partial").length;
  const reasons: Record<string, number> = {};
  for (const row of rows) if (row.rating !== "up") reasons[row.reason || "none"] = (reasons[row.reason || "none"] || 0) + 1;

  // Recent answers that were not fully useful, with the question that led to them and nothing about who asked.
  const negatives = rows.filter((row) => row.rating !== "up").slice(0, 20);
  const recent = [];
  for (const row of negatives) recent.push(await notUsefulItem(db, row));

  return {
    days,
    minGroupSize: MIN_GROUP_SIZE,
    total: rows.length,
    up,
    partial,
    down: rows.length - up - partial,
    score: satisfaction(up, partial, rows.length),
    reasons,
    byRole: bucketize(rows.map((row) => ({ key: mainRole(rolesOf[row.accountId] || []), rating: row.rating })), MIN_GROUP_SIZE),
    byCourse: bucketize(rows.map((row) => ({ key: row.courseName, rating: row.rating })), MIN_GROUP_SIZE),
    byTopic: bucketize(rows.map((row) => ({ key: row.topic, rating: row.rating })), MIN_GROUP_SIZE),
    byLanguage: bucketize(rows.map((row) => ({ key: row.language, rating: row.rating })), MIN_GROUP_SIZE),
    recentNotUseful: recent,
  };
}

interface NotUsefulRow {
  rating: string; reason: string | null; comment: string | null; createdAt: Date; topic: string | null;
  language: string | null; answer: string; chatSessionId: string; answeredAt: Date;
}

/** The question that led to an answer, and nothing about who asked it. */
async function notUsefulItem(db: AnyDbClient, row: NotUsefulRow) {
  const [question] = await db
    .select({ content: chatMessages.content })
    .from(chatMessages)
    .where(and(eq(chatMessages.chatSessionId, row.chatSessionId), eq(chatMessages.role, "user"), sql`${chatMessages.timestamp} <= ${row.answeredAt}`, activeChatMessage))
    .orderBy(desc(chatMessages.timestamp))
    .limit(1);
  return {
    rating: row.rating,
    question: question?.content ?? "",
    answer: row.answer,
    reason: row.reason,
    comment: row.comment,
    topic: row.topic,
    language: row.language,
    ratedAt: row.createdAt,
  };
}

export const PAGE_SIZES = [6, 12, 24, 48];

export interface NotUsefulFilters extends SummaryFilters { page?: unknown; pageSize?: unknown; rating?: unknown }

/** Answers rated "partial" or "down", newest first, one page at a time with the same filters as the summary. */
export async function listNotUseful(db: AnyDbClient, options: NotUsefulFilters) {
  const days = Math.min(365, Math.max(1, Number(options.days) || 30));
  const since = new Date(Date.now() - days * 86400000);
  const requestedSize = Number(options.pageSize);
  const pageSize = PAGE_SIZES.indexOf(requestedSize) !== -1 ? requestedSize : 12;
  const page = Math.max(1, Math.floor(Number(options.page)) || 1);
  if (options.rating !== undefined && options.rating !== "" && options.rating !== "partial" && options.rating !== "down") {
    throw new AppError("chatFeedback.filterInvalid", 400);
  }
  const ratingCondition = options.rating === "partial" || options.rating === "down"
    ? eq(chatMessageFeedback.rating, options.rating)
    : ne(chatMessageFeedback.rating, "up");
  const where = and(gte(chatMessageFeedback.updatedAt, since), ratingCondition, ...summaryConditions(options));

  const [{ total }] = await db
    .select({ total: count() })
    .from(chatMessageFeedback)
    .innerJoin(chatMessages, eq(chatMessages.id, chatMessageFeedback.messageId))
    .leftJoin(studentProfiles, eq(studentProfiles.accountId, chatMessageFeedback.accountId))
    .leftJoin(professorProfiles, eq(professorProfiles.accountId, chatMessageFeedback.accountId))
    .where(where);
  const totalPages = Math.max(1, Math.ceil(Number(total) / pageSize));
  const current = Math.min(page, totalPages);
  const rows = await db
    .select({
      rating: chatMessageFeedback.rating,
      reason: chatMessageFeedback.reason,
      comment: chatMessageFeedback.comment,
      createdAt: chatMessageFeedback.updatedAt,
      topic: chatMessages.detectedTopic,
      language: sql<string | null>`${chatMessages.metadata}->>'outputLanguage'`,
      answer: chatMessages.content,
      chatSessionId: chatMessages.chatSessionId,
      answeredAt: chatMessages.timestamp,
    })
    .from(chatMessageFeedback)
    .innerJoin(chatMessages, eq(chatMessages.id, chatMessageFeedback.messageId))
    .leftJoin(studentProfiles, eq(studentProfiles.accountId, chatMessageFeedback.accountId))
    .leftJoin(professorProfiles, eq(professorProfiles.accountId, chatMessageFeedback.accountId))
    .where(where)
    .orderBy(desc(chatMessageFeedback.updatedAt), desc(chatMessageFeedback.id))
    .limit(pageSize)
    .offset((current - 1) * pageSize);
  const items = [];
  for (const row of rows) items.push(await notUsefulItem(db, row as NotUsefulRow));
  return { items, total: Number(total), page: current, pageSize, totalPages };
}
