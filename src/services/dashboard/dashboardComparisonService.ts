import { sql, type SQL } from "drizzle-orm";
import { getDb } from "../../db/client";
import type { Filters } from "../analytics/analyticsService";
import { feedbackSummary } from "../chat/chatFeedbackService";

/**
 * Data for the direct comparison charts of the Dashboard (item 5): exams, weekly engagement and
 * satisfaction with the chat, for one selection at a time (the screen asks for A and for B).
 * Only aggregated numbers leave this module; small groups are hidden where a person could be told apart.
 */
export const MIN_GROUP = 5;
const MAX_WEEKS = 26;
const DAY = 86400000;

/** Students of the selection, as a condition on student_profiles (alias sp). */
function studentScope(filters: Filters): SQL {
  const parts: SQL[] = [];
  if (filters.universityId) parts.push(sql`sp.school_id = ${filters.universityId}`);
  if (filters.courseId) parts.push(sql`sp.course_id = ${filters.courseId}`);
  if (filters.classId) parts.push(sql`sp.class_id = ${filters.classId}`);
  if (filters.studentId) parts.push(sql`sp.account_id = ${filters.studentId}`);
  if (filters.disciplineId) parts.push(sql`sp.class_id IN (SELECT class_id FROM class_disciplines WHERE discipline_id = ${filters.disciplineId})`);
  return parts.length ? sql.join(parts, sql` AND `) : sql`TRUE`;
}

function period(filters: Filters, now: Date) {
  const end = filters.endDate ? new Date(+new Date(filters.endDate) + DAY) : now;
  const start = filters.startDate ? new Date(filters.startDate) : null;
  return { start, end };
}

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

/* ── Exams: average grade (0–10) and submission rate of released exams ───── */

export async function examResults(filters: Filters, now = new Date()) {
  const { start, end } = period(filters, now);
  const scope = studentScope(filters);
  const exam = filters.disciplineId ? sql`AND e.discipline_id = ${filters.disciplineId}` : sql``;
  const from = start ? sql`AND e.released_at >= ${start}` : sql``;
  // Expected students: those of the selection in the exam's class (or in the classes of its discipline).
  const result = await getDb().execute(sql`
    SELECT e.id, e.title, to_char(e.released_at, 'YYYY-MM-DD') AS released,
      count(DISTINCT sp.account_id)::int AS expected,
      count(DISTINCT s.student_id) FILTER (WHERE s.status = 'submitted')::int AS submitted,
      avg(s.grade) FILTER (WHERE s.status = 'submitted' AND s.grade IS NOT NULL) AS average
    FROM exams e
    JOIN student_profiles sp ON (e.class_id IS NOT NULL AND sp.class_id = e.class_id)
      OR (e.class_id IS NULL AND sp.class_id IN (SELECT class_id FROM class_disciplines WHERE discipline_id = e.discipline_id))
    LEFT JOIN exam_submissions s ON s.exam_id = e.id AND s.student_id = sp.account_id
    WHERE e.status = 'released' AND e.released_at < ${end} ${from} ${exam} AND ${scope}
    GROUP BY e.id, e.title, e.released_at
    ORDER BY e.released_at`);
  const exams = (result.rows as Array<{ title: string; released: string; expected: number; submitted: number; average: string | number | null }>).map((row) => ({
    title: row.title,
    releasedAt: row.released,
    expected: Number(row.expected),
    submitted: Number(row.submitted),
    submissionRate: Number(row.expected) ? round(Number(row.submitted) / Number(row.expected), 3) : null,
    averageGrade: row.average === null ? null : round(Number(row.average)),
  }));
  const expected = exams.reduce((sum, item) => sum + item.expected, 0);
  const submitted = exams.reduce((sum, item) => sum + item.submitted, 0);
  const graded = exams.filter((item) => item.averageGrade !== null);
  const weighted = graded.reduce((sum, item) => sum + item.averageGrade! * item.submitted, 0);
  const gradedCount = graded.reduce((sum, item) => sum + item.submitted, 0);
  return {
    exams,
    expected,
    submitted,
    submissionRate: expected ? round(submitted / expected, 3) : null,
    averageGrade: gradedCount ? round(weighted / gradedCount) : null,
  };
}

/* ── Weekly engagement: share of the selection's students active each week ── */

export async function weeklyEngagement(filters: Filters, now = new Date()) {
  const { start, end } = period(filters, now);
  const first = start && +end - +start <= MAX_WEEKS * 7 * DAY ? start : new Date(+end - MAX_WEEKS * 7 * DAY);
  const scope = studentScope(filters);
  const [{ students }] = (await getDb().execute(sql`SELECT count(*)::int AS students FROM student_profiles sp WHERE ${scope}`)).rows as Array<{ students: number }>;
  const result = await getDb().execute(sql`
    SELECT to_char(date_trunc('week', s.session_start), 'YYYY-MM-DD') AS week,
      count(DISTINCT ua.user_id)::int AS active, count(*)::int AS sessions,
      COALESCE(sum(s.session_duration), 0)::float / 60 AS minutes
    FROM analysis_sessions s
    JOIN user_analyses ua ON ua.id = s.analysis_id
    JOIN student_profiles sp ON sp.account_id = ua.user_id
    WHERE s.session_start >= ${first} AND s.session_start < ${end} AND ${scope}
    GROUP BY 1 ORDER BY 1`);
  const total = Number(students);
  const weeks = (result.rows as Array<{ week: string; active: number; sessions: number; minutes: number }>).map((row) => ({
    week: row.week,
    activeStudents: Number(row.active),
    sessions: Number(row.sessions),
    minutes: round(Number(row.minutes), 1),
    activeShare: total ? round(Number(row.active) / total, 3) : null,
  }));
  const shares = weeks.map((item) => item.activeShare).filter((value): value is number => value !== null);
  return { students: total, weeks, averageActiveShare: shares.length ? round(shares.reduce((a, b) => a + b, 0) / shares.length, 3) : null };
}

/* ── Satisfaction with the chat (same rules as the ratings page) ───────────── */

export async function chatSatisfaction(filters: Filters, now = new Date()) {
  // A single student's ratings would identify the person: not offered for that scope.
  if (filters.studentId) return { available: false as const, reason: "student" as const };
  const { start, end } = period(filters, now);
  const days = start ? Math.min(365, Math.max(1, Math.ceil((+end - +start) / DAY))) : 365;
  const summary = await feedbackSummary(getDb(), { days, institutionId: filters.universityId, courseId: filters.courseId, classId: filters.classId });
  if (summary.total < MIN_GROUP) return { available: false as const, reason: "small" as const, total: summary.total, minGroupSize: MIN_GROUP };
  return {
    available: true as const,
    days,
    disciplineIgnored: !!filters.disciplineId,
    total: summary.total,
    up: summary.up,
    partial: summary.partial,
    down: summary.down,
    score: summary.score,
    byTopic: summary.byTopic.groups.slice(0, 6).map((group) => ({ topic: group.key, total: group.total, score: group.score })),
  };
}
