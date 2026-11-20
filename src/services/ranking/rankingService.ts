import type { Request } from "express";
import { and, eq, sql, type SQL } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { getDb } from "../../db/client";
import { currentEnvironment, runInEnvironment } from "../../db/environment";
import { rankingSettings, universities } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { isOwner } from "../sandbox/sandboxConfig";
import { featuresForChain, hiddenPracticeTypes } from "../features/featureService";

/**
 * Ranking of students by points earned in a period, in cascade: class → course → institution.
 *
 * Points (defaults, changed by the owner for the platform or for one institution):
 *   practice    each different workbench exercise solved          10
 *   quiz        each correct quiz answer (professor and adaptive)  5
 *   exam        grade (0–10) of each released exam × 10            10
 *   flashcards  each card mastered (box 4 or 5)                    2
 * Classes and courses are compared by the average per student; groups with fewer than MIN_GROUP
 * students are left out of that comparison. Professors see the classes they teach, coordination
 * the courses it coordinates, admins the whole institution; students only if the owner allows it,
 * and then only their own class, without the classmates' names unless also allowed.
 */
export const MIN_GROUP = 5;
export const PERIODS = [7, 30, 90, 180, 365] as const;
export const SOURCES = ["practice", "quiz", "exam", "flashcards"] as const;
export type Source = (typeof SOURCES)[number];
export const LEVELS = ["student", "professor", "coordinator", "admin"] as const;
export type Level = (typeof LEVELS)[number];
export interface Rules {
  periodDays: number;
  weights: Record<Source, number>;
  visibleTo: Record<Level, boolean>;
  /** When students may see the ranking: also the classmates' names (otherwise only their own). */
  studentNames: boolean;
}
export const DEFAULT_RULES: Rules = {
  periodDays: 30,
  weights: { practice: 10, quiz: 5, exam: 10, flashcards: 2 },
  visibleTo: { student: false, professor: true, coordinator: true, admin: true },
  studentNames: false,
};

type User = NonNullable<Request["user"]>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidList = (list: string[]) => sql.join(list.map((value) => sql`${value}::uuid`), sql`, `);

export function viewerLevel(user: Pick<User, "role">): Level {
  if (user.role.includes("admin")) return "admin";
  if (user.role.includes("course-coordinator")) return "coordinator";
  if (user.role.includes("professor")) return "professor";
  return "student";
}

/* ── Rules ──────────────────────────────────────────────────────────────── */

export interface FieldIssue { field: string; code: string; params?: Record<string, number> }
export class RankingValidationError extends AppError {
  constructor(public readonly issues: FieldIssue[]) { super("ranking.invalid", 400); }
}

/** Only known keys, each checked; anything missing keeps the value from the level above. */
export function parseRules(body: unknown): Partial<Rules> {
  const raw = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const issues: FieldIssue[] = [];
  const rules: Partial<Rules> = {};
  if (raw.periodDays !== undefined) {
    if ((PERIODS as readonly unknown[]).indexOf(raw.periodDays) === -1) issues.push({ field: "periodDays", code: "INVALID" });
    else rules.periodDays = raw.periodDays as number;
  }
  if (raw.weights !== undefined) {
    const weights = raw.weights && typeof raw.weights === "object" ? raw.weights as Record<string, unknown> : {};
    const parsed = {} as Record<Source, number>;
    for (const source of SOURCES) {
      const value = weights[source];
      if (value === undefined) continue;
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) issues.push({ field: `weights.${source}`, code: "RANGE", params: { min: 0, max: 100 } });
      else parsed[source] = value;
    }
    rules.weights = parsed;
  }
  if (raw.visibleTo !== undefined) {
    const visible = raw.visibleTo && typeof raw.visibleTo === "object" ? raw.visibleTo as Record<string, unknown> : {};
    const parsed = {} as Record<Level, boolean>;
    for (const level of LEVELS) {
      if (visible[level] === undefined) continue;
      if (typeof visible[level] !== "boolean") issues.push({ field: `visibleTo.${level}`, code: "INVALID" });
      else parsed[level] = visible[level] as boolean;
    }
    rules.visibleTo = parsed;
  }
  if (raw.studentNames !== undefined) {
    if (typeof raw.studentNames !== "boolean") issues.push({ field: "studentNames", code: "INVALID" });
    else rules.studentNames = raw.studentNames;
  }
  if (issues.length) throw new RankingValidationError(issues);
  return rules;
}

function merge(base: Rules, part: Partial<Rules> | undefined): Rules {
  if (!part) return base;
  return {
    periodDays: part.periodDays ?? base.periodDays,
    weights: { ...base.weights, ...(part.weights ?? {}) },
    visibleTo: { ...base.visibleTo, ...(part.visibleTo ?? {}) },
    studentNames: part.studentNames ?? base.studentNames,
  };
}

async function storedRules(db: AnyDbClient, scope: "global" | "institution", scopeId: string): Promise<Partial<Rules> | undefined> {
  const [row] = await db.select({ config: rankingSettings.config }).from(rankingSettings)
    .where(and(eq(rankingSettings.scope, scope), eq(rankingSettings.scopeId, scopeId))).limit(1);
  if (!row) return undefined;
  try { return parseRules(row.config); } catch { return undefined; }
}

/** Platform rules (always those of the real environment), then the institution's own changes. */
export async function effectiveRules(db: AnyDbClient, universityId: string | null) {
  const global = currentEnvironment() === "sandbox"
    ? await runInEnvironment("production", () => storedRules(getDb(), "global", ""))
    : await storedRules(db, "global", "");
  const institution = universityId ? await storedRules(db, "institution", universityId) : undefined;
  return merge(merge(DEFAULT_RULES, global), institution);
}

/** Owner: the defaults, what is saved for the platform and for one institution, and the result. */
export async function getSettings(db: AnyDbClient, user: User, universityId: unknown) {
  if (!isOwner(user)) throw new AppError("auth.accessDeniedCapital", 403);
  const id = typeof universityId === "string" && UUID.test(universityId) ? universityId : null;
  const global = await storedRules(db, "global", "");
  const institution = id ? await storedRules(db, "institution", id) : undefined;
  return { defaults: DEFAULT_RULES, global: global ?? null, institution: institution ?? null, effective: merge(merge(DEFAULT_RULES, global), institution), periods: PERIODS };
}

export async function saveSettings(db: AnyDbClient, user: User, body: unknown) {
  if (!isOwner(user)) throw new AppError("auth.accessDeniedCapital", 403);
  const raw = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const scope = raw.scope === "institution" ? "institution" : raw.scope === "global" ? "global" : null;
  if (!scope) throw new AppError("ranking.scopeInvalid", 400);
  const scopeId = scope === "global" ? "" : typeof raw.scopeId === "string" && UUID.test(raw.scopeId) ? raw.scopeId : "";
  if (scope === "institution") {
    const [found] = scopeId ? await db.select({ id: universities.id }).from(universities).where(eq(universities.id, scopeId)).limit(1) : [];
    if (!found) throw new AppError("ranking.scopeInvalid", 400);
  }
  const config = parseRules(raw.config);
  const now = new Date();
  await db.insert(rankingSettings).values({ scope, scopeId, config: config as Record<string, unknown>, updatedBy: user.id, updatedAt: now })
    .onConflictDoUpdate({ target: [rankingSettings.scope, rankingSettings.scopeId], set: { config: config as Record<string, unknown>, updatedBy: user.id, updatedAt: now } });
  return getSettings(db, user, scope === "institution" ? scopeId : null);
}

/** Back to inheriting from the level above. */
export async function clearSettings(db: AnyDbClient, user: User, body: unknown) {
  if (!isOwner(user)) throw new AppError("auth.accessDeniedCapital", 403);
  const raw = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const scope = raw.scope === "institution" ? "institution" : "global";
  const scopeId = scope === "global" ? "" : typeof raw.scopeId === "string" ? raw.scopeId : "";
  await db.delete(rankingSettings).where(and(eq(rankingSettings.scope, scope), eq(rankingSettings.scopeId, scopeId)));
}

/* ── What each profile may open ─────────────────────────────────────────── */

type Run = <T>(query: SQL) => Promise<T[]>;
const runner = (db: AnyDbClient): Run => async <T,>(query: SQL) => (await db.execute(query)).rows as unknown as T[];
const coordinatedCourses = (user: User) => (Array.isArray(user.courses) ? user.courses : user.courses ? [user.courses] : [])
  .filter((value): value is string => typeof value === "string" && UUID.test(value));

interface ClassOption { id: string; name: string; courseId: string; courseName: string; institutionId: string }

export async function rankingScopes(db: AnyDbClient, user: User) {
  const run = runner(db);
  const level = viewerLevel(user);
  const rules = await effectiveRules(db, level === "admin" ? null : (user.school as string | null) ?? null);
  const none = { allowed: false, level, institutions: [], courses: [], classes: [] as ClassOption[] };
  if (!rules.visibleTo[level]) return none;
  const base = sql`SELECT k.id, k.name, c.id AS "courseId", c.name AS "courseName", c.university_id AS "institutionId" FROM classes k JOIN courses c ON c.id = k.course_id`;
  if (level === "admin") {
    const institutions = await run<{ id: string; name: string }>(sql`SELECT id, name FROM universities ORDER BY name`);
    const courses = await run<{ id: string; name: string; institutionId: string }>(sql`SELECT id, name, university_id AS "institutionId" FROM courses ORDER BY name`);
    const classes = await run<ClassOption>(sql`${base} ORDER BY c.name, k.name`);
    return { allowed: true, level, institutions, courses, classes };
  }
  if (level === "coordinator") {
    const own = coordinatedCourses(user);
    if (!own.length) return { ...none, allowed: true };
    const courses = await run<{ id: string; name: string; institutionId: string }>(sql`SELECT id, name, university_id AS "institutionId" FROM courses WHERE id IN (${uuidList(own)}) ORDER BY name`);
    const classes = await run<ClassOption>(sql`${base} WHERE c.id IN (${uuidList(own)}) ORDER BY c.name, k.name`);
    return { allowed: true, level, institutions: [], courses, classes };
  }
  if (level === "professor") {
    const classes = await run<ClassOption>(sql`${base} WHERE k.id IN (
      SELECT class_id FROM professor_classes WHERE professor_id = ${user.id}
      UNION SELECT cd.class_id FROM class_disciplines cd JOIN professor_disciplines pd ON pd.discipline_id = cd.discipline_id WHERE pd.professor_id = ${user.id})
      ORDER BY c.name, k.name`);
    return { allowed: true, level, institutions: [], courses: [], classes };
  }
  const classes = await run<ClassOption>(sql`${base} WHERE k.id = (SELECT class_id FROM student_profiles WHERE account_id = ${user.id})`);
  return { allowed: true, level, institutions: [], courses: [], classes };
}

/* ── The ranking ────────────────────────────────────────────────────────── */

interface Row { id: string; name: string; class_id: string | null; class_name: string | null; course_id: string | null; course_name: string | null; practice: number; quiz: number; exam: number; flashcards: number }

/** Same points, same position (1, 1, 3…). */
function positions<T extends { points: number }>(items: T[]): Array<T & { position: number }> {
  let last = Number.NaN;
  let position = 0;
  return items.map((item, index) => {
    if (item.points !== last) { position = index + 1; last = item.points; }
    return { ...item, position };
  });
}

export async function ranking(db: AnyDbClient, user: User, input: { scope?: unknown; id?: unknown }, now = new Date()) {
  const scopes = await rankingScopes(db, user);
  if (!scopes.allowed) throw new AppError("ranking.unavailable", 403);
  const scope = input.scope === "course" || input.scope === "institution" ? input.scope : "class";
  const id = typeof input.id === "string" ? input.id : "";
  const option = scope === "class" ? scopes.classes.find((item) => item.id === id)
    : scope === "course" ? scopes.courses.find((item) => item.id === id)
      : scopes.institutions.find((item) => item.id === id);
  if (!option) throw new AppError("ranking.notFound", 404);
  const institutionId = "institutionId" in option ? option.institutionId : option.id;
  const rules = await effectiveRules(db, institutionId);
  // Activities of features turned off where this selection is never count (nor show).
  const released = await featuresForChain(db, scope === "class"
    ? [["class", id], ["course", (option as { courseId: string }).courseId], ["institution", institutionId]]
    : scope === "course" ? [["course", id], ["institution", institutionId]] : [["institution", id]]);
  const hiddenTypes = hiddenPracticeTypes(released);
  const practiceOn = hiddenTypes.length < 3;
  const active: Record<Source, boolean> = { practice: practiceOn, quiz: released.quiz, exam: released.exams, flashcards: released.flashcards };
  const weights = { ...rules.weights };
  for (const source of SOURCES) if (!active[source]) weights[source] = 0;
  const practiceTypes = hiddenTypes.length ? sql`AND ea.exercise_type NOT IN (${sql.join(hiddenTypes.map((type) => sql`${type}`), sql`, `)})` : sql``;
  if (!rules.visibleTo[scopes.level]) throw new AppError("ranking.unavailable", 403);
  const since = new Date(now.getTime() - rules.periodDays * 86400000);
  const filter = scope === "class" ? sql`sp.class_id = ${id}` : scope === "course" ? sql`sp.course_id = ${id}` : sql`sp.school_id = ${id}`;

  const rows = await runner(db)<Row>(sql`
    SELECT sp.account_id AS id, a.name, sp.class_id, k.name AS class_name, sp.course_id, c.name AS course_name,
      (SELECT count(DISTINCT (ea.exercise_type, ea.exercise_id))::int FROM exercise_attempts ea
         WHERE ea.student_id = sp.account_id AND ea.mode = 'practice' AND ea.is_correct AND ea.created_at >= ${since} ${practiceTypes}) AS practice,
      ((SELECT count(*)::int FROM professor_quiz_answers pa JOIN professor_quiz_attempts pt ON pt.id = pa.attempt_id
         WHERE pt.student_id = sp.account_id AND pa.is_correct AND pt.completed_at >= ${since})
       + (SELECT count(*)::int FROM quiz_question_attempts qa JOIN quiz_sessions qs ON qs.id = qa.quiz_session_id
         WHERE qs.user_id = sp.account_id AND qa.is_correct AND qa.timestamp >= ${since})) AS quiz,
      (SELECT COALESCE(sum(es.grade), 0)::float FROM exam_submissions es JOIN exams e ON e.id = es.exam_id
         WHERE es.student_id = sp.account_id AND e.status = 'released' AND e.released_at >= ${since} AND es.grade IS NOT NULL) AS exam,
      (SELECT count(*)::int FROM flashcard_reviews fr WHERE fr.student_id = sp.account_id AND fr.box >= 4 AND fr.updated_at >= ${since}) AS flashcards
    FROM student_profiles sp
    JOIN accounts a ON a.id = sp.account_id AND a.status = 'active'
    LEFT JOIN classes k ON k.id = sp.class_id
    LEFT JOIN courses c ON c.id = sp.course_id
    WHERE ${filter}`);

  const scored = rows.map((row) => {
    const breakdown = {
      practice: Number(row.practice) * weights.practice,
      quiz: Number(row.quiz) * weights.quiz,
      exam: Math.round(Number(row.exam) * weights.exam),
      flashcards: Number(row.flashcards) * weights.flashcards,
    };
    return { row, breakdown, points: breakdown.practice + breakdown.quiz + breakdown.exam + breakdown.flashcards };
  }).sort((a, b) => b.points - a.points || a.row.name.localeCompare(b.row.name));

  const student = scopes.level === "student";
  const students = positions(scored).map(({ row, breakdown, points, position }) => {
    const me = row.id === user.id;
    const named = !student || me || rules.studentNames;
    return { position, name: named ? row.name : null, className: row.class_name, points, me, breakdown: !student || me ? breakdown : undefined };
  });

  // Cascade: the level below compared by the average per student (small groups left out).
  let groups: Array<{ id: string; name: string; students: number; averagePoints: number; position: number }> = [];
  let hiddenGroups = 0;
  if (scope !== "class" && !student) {
    const key = scope === "course" ? "class" : "course";
    const byGroup = new Map<string, { name: string; total: number; count: number }>();
    for (const item of scored) {
      const groupId = key === "class" ? item.row.class_id : item.row.course_id;
      const name = key === "class" ? item.row.class_name : item.row.course_name;
      if (!groupId || !name) continue;
      const entry = byGroup.get(groupId) ?? { name, total: 0, count: 0 };
      entry.total += item.points; entry.count += 1;
      byGroup.set(groupId, entry);
    }
    const eligible = Array.from(byGroup.entries()).filter(([, entry]) => entry.count >= MIN_GROUP);
    hiddenGroups = byGroup.size - eligible.length;
    groups = positions(eligible
      .map(([groupId, entry]) => ({ id: groupId, name: entry.name, students: entry.count, points: Math.round((entry.total / entry.count) * 10) / 10 }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)))
      .map(({ points, ...rest }) => ({ ...rest, averagePoints: points }));
  }

  return {
    scope, id, name: option.name,
    rules: { periodDays: rules.periodDays, weights, studentNames: rules.studentNames, sources: SOURCES.filter((source) => active[source]) },
    since: since.toISOString(),
    viewer: { level: scopes.level, canConfigure: isOwner(user) && currentEnvironment() === "production" },
    minGroupSize: MIN_GROUP,
    groupLevel: scope === "course" ? "class" : scope === "institution" ? "course" : null,
    groups, hiddenGroups, students,
  };
}
