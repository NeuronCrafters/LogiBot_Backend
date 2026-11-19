import type { Request } from "express";
import { and, eq, sql, type SQL } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { accounts, professorClasses } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { assertClassInNetwork, assertCourseInNetwork, requireNetwork, seesEveryNetwork } from "../academic/networkScope";
import { featuresFor } from "../features/featureService";

/**
 * Proficiency per concept (phase 8): negation, conjunction, conditional… and the algorithm concepts.
 * Sources: workbench attempts and exams, the latter only after the professor releases the results.
 * In a truth table each concept counts on its own (a mistake in the conditional column does not
 * mark the negation wrong). Aggregated views hide concepts with fewer than MIN_GROUP students.
 */
export const MIN_GROUP = 5;
export const PERIODS = [30, 90, 365, 0];
export const SCOPES = ["me", "class", "course", "institution", "all"] as const;
export type ProficiencyScope = (typeof SCOPES)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TREND_WEEKS = 12;

type User = NonNullable<Request["user"]>;
interface Row { student_id: string; concept: string; week: string; score: number; source: "practice" | "exam" }
interface Tally { total: number; points: number }
const tally = (): Tally => ({ total: 0, points: 0 });
const ratio = (value: Tally) => (value.total ? Math.round((value.points / value.total) * 1000) / 1000 : null);

export interface ProficiencyRequest { scope?: unknown; id?: unknown; days?: unknown }

/** Who may see what. Returns the SQL condition on student_profiles (sp) and whether people may be listed. */
export async function resolveScope(db: AnyDbClient, user: User, input: ProficiencyRequest): Promise<{ scope: ProficiencyScope; id: string; where: SQL; listStudents: boolean; aggregated: boolean }> {
  const scope = (SCOPES as readonly unknown[]).indexOf(input.scope) !== -1 ? input.scope as ProficiencyScope : user.role.includes("student") ? "me" : null;
  if (!scope) throw new AppError("concepts.scopeInvalid", 400);
  const id = typeof input.id === "string" ? input.id : "";
  if (scope !== "me" && scope !== "all" && !UUID.test(id)) throw new AppError("concepts.scopeInvalid", 400);
  const isCoordinator = user.role.includes("course-coordinator");
  const isAdmin = user.role.includes("admin");

  if (scope === "me") {
    if (!user.role.includes("student")) throw new AppError("concepts.forbidden", 403);
    return { scope, id: "", where: sql`sp.account_id = ${user.id}`, listStudents: false, aggregated: false };
  }
  if (scope === "class") {
    const [teaches] = await db.select({ classId: professorClasses.classId }).from(professorClasses)
      .where(and(eq(professorClasses.professorId, user.id), eq(professorClasses.classId, id))).limit(1);
    if (!teaches) {
      if (!isAdmin && !isCoordinator) throw new AppError("concepts.forbidden", 403);
      await assertClassInNetwork(db, user, id);
    }
    // Only the professor of the class sees each student; coordination and admins see the class as a whole.
    return { scope, id, where: sql`sp.class_id = ${id}`, listStudents: !!teaches, aggregated: !teaches };
  }
  if (scope === "course") {
    if (!isAdmin && !isCoordinator) throw new AppError("concepts.forbidden", 403);
    await assertCourseInNetwork(db, user, id);
    return { scope, id, where: sql`sp.course_id = ${id}`, listStudents: false, aggregated: true };
  }
  if (scope === "institution") {
    if (!isAdmin && !(isCoordinator && requireNetwork(user) === id)) throw new AppError("concepts.forbidden", 403);
    return { scope, id, where: sql`sp.school_id = ${id}`, listStudents: false, aggregated: true };
  }
  if (!seesEveryNetwork(user)) throw new AppError("concepts.forbidden", 403);
  return { scope, id: "", where: sql`TRUE`, listStudents: false, aggregated: true };
}

async function loadRows(db: AnyDbClient, where: SQL, since: Date | null, hiddenTypes: string[] = []): Promise<Row[]> {
  const practiceSince = since ? sql`AND ea.created_at >= ${since}` : sql``;
  const examSince = since ? sql`AND e.released_at >= ${since}` : sql``;
  // Exercise types turned off in the release page leave no trace in the panel.
  const hidden = hiddenTypes.length ? sql.join(hiddenTypes.map((type) => sql`${type}`), sql`, `) : null;
  const practiceTypes = hidden ? sql`AND ea.exercise_type NOT IN (${hidden})` : sql``;
  const examTypes = hidden ? sql`AND q.type NOT IN (${hidden})` : sql``;
  const result = await db.execute(sql`
    SELECT ea.student_id, c.concept, to_char(date_trunc('week', ea.created_at), 'YYYY-MM-DD') AS week, 'practice' AS source,
      CASE WHEN ea.exercise_type = 'truth_table' AND jsonb_typeof(ea.result->'errorsByConcept') = 'object'
        THEN CASE WHEN COALESCE((ea.result->'errorsByConcept'->>c.concept)::int, 0) = 0 THEN 1 ELSE 0 END
        ELSE CASE WHEN ea.is_correct THEN 1 ELSE 0 END END::float AS score
    FROM exercise_attempts ea
    JOIN student_profiles sp ON sp.account_id = ea.student_id
    CROSS JOIN LATERAL jsonb_array_elements_text(ea.concepts) AS c(concept)
    WHERE ea.mode = 'practice' AND ${where} ${practiceSince} ${practiceTypes}
    UNION ALL
    SELECT s.student_id, c.concept, to_char(date_trunc('week', e.released_at), 'YYYY-MM-DD') AS week, 'exam' AS source,
      CASE WHEN q.type = 'essay' THEN br.score
        ELSE CASE WHEN (s.objective_results->(q.id::text)->>'correct')::boolean THEN 1 ELSE 0 END END::float AS score
    FROM exam_submissions s
    JOIN exams e ON e.id = s.exam_id AND e.status = 'released'
    JOIN exam_questions q ON q.exam_id = e.id
    JOIN student_profiles sp ON sp.account_id = s.student_id
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(q.snapshot->'concepts', '[]'::jsonb)) AS c(concept)
    LEFT JOIN blind_reviews br ON br.submission_id = s.id AND br.exam_question_id = q.id
    WHERE s.status = 'submitted' AND ${where} ${examSince} ${examTypes}
  `);
  return (result.rows as unknown as Row[]).filter((row) => row.score !== null && row.score !== undefined);
}

export async function conceptProficiency(db: AnyDbClient, user: User, input: ProficiencyRequest, now = new Date()) {
  const days = PERIODS.indexOf(Number(input.days)) !== -1 ? Number(input.days) : 90;
  const resolved = await resolveScope(db, user, input);
  const since = days ? new Date(now.getTime() - days * 86400000) : null;
  const released = await featuresFor(db, user);
  const rows = await loadRows(db, resolved.where, since, released.practice_parsons ? [] : ["parsons"]);

  const byConcept: Record<string, { all: Tally; practice: Tally; exam: Tally; students: Record<string, true>; weeks: Record<string, Tally> }> = {};
  const byStudent: Record<string, Record<string, Tally>> = {};
  for (const row of rows) {
    const entry = byConcept[row.concept] = byConcept[row.concept] || { all: tally(), practice: tally(), exam: tally(), students: {}, weeks: {} };
    const score = Number(row.score);
    for (const target of [entry.all, entry[row.source], entry.weeks[row.week] = entry.weeks[row.week] || tally()]) {
      target.total++;
      target.points += score;
    }
    entry.students[row.student_id] = true;
    const student = byStudent[row.student_id] = byStudent[row.student_id] || {};
    const cell = student[row.concept] = student[row.concept] || tally();
    cell.total++;
    cell.points += score;
  }

  let hidden = 0;
  const concepts = Object.keys(byConcept).sort().map((concept) => {
    const entry = byConcept[concept];
    const students = Object.keys(entry.students).length;
    if (resolved.aggregated && students < MIN_GROUP) { hidden++; return null; }
    const weeks = Object.keys(entry.weeks).sort().slice(-TREND_WEEKS);
    return {
      concept,
      total: entry.all.total,
      score: ratio(entry.all),
      students,
      practice: { total: entry.practice.total, score: ratio(entry.practice) },
      exam: { total: entry.exam.total, score: ratio(entry.exam) },
      trend: weeks.map((week) => ({ week, total: entry.weeks[week].total, score: ratio(entry.weeks[week]) })),
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  let students: Array<{ id: string; name: string; concepts: Record<string, { total: number; score: number | null }> }> | undefined;
  if (resolved.listStudents) {
    const people = await db.execute(sql`
      SELECT a.id, a.name FROM student_profiles sp JOIN ${accounts} a ON a.id = sp.account_id
      WHERE ${resolved.where} ORDER BY a.name`);
    students = (people.rows as Array<{ id: string; name: string }>).map((person) => {
      const cells: Record<string, { total: number; score: number | null }> = {};
      const own = byStudent[person.id] || {};
      for (const concept of Object.keys(own)) cells[concept] = { total: own[concept].total, score: ratio(own[concept]) };
      return { id: person.id, name: person.name, concepts: cells };
    });
  }

  return { scope: resolved.scope, id: resolved.id, days, minGroupSize: MIN_GROUP, aggregated: resolved.aggregated, concepts, hidden, ...(students ? { students } : {}) };
}

/** The selections each profile may open, so the screen only offers what the API allows. */
export async function proficiencyScopes(db: AnyDbClient, user: User) {
  const isAdmin = user.role.includes("admin");
  const isCoordinator = user.role.includes("course-coordinator");
  const network = !isAdmin && isCoordinator && typeof user.school === "string" ? user.school : null;
  const taught = await db.execute(sql`SELECT class_id FROM professor_classes WHERE professor_id = ${user.id}`);
  const teaches = new Set((taught.rows as Array<{ class_id: string }>).map((row) => row.class_id));
  const filter = isAdmin ? sql`TRUE` : network ? sql`u.id = ${network}` : sql`FALSE`;
  const rows = await db.execute(sql`
    SELECT u.id AS institution_id, u.name AS institution_name, c.id AS course_id, c.name AS course_name, k.id AS class_id, k.name AS class_name
    FROM classes k JOIN courses c ON c.id = k.course_id JOIN universities u ON u.id = c.university_id
    WHERE ${filter} OR k.id IN (SELECT class_id FROM professor_classes WHERE professor_id = ${user.id})
    ORDER BY u.name, c.name, k.name`);
  type Item = { institution_id: string; institution_name: string; course_id: string; course_name: string; class_id: string; class_name: string };
  const items = rows.rows as Item[];
  const unique = <T extends { id: string }>(list: T[]) => list.filter((item, index) => list.findIndex((other) => other.id === item.id) === index);
  const wide = isAdmin || !!network;
  return {
    me: user.role.includes("student"),
    all: isAdmin,
    institutions: wide ? unique(items.filter((item) => isAdmin || item.institution_id === network).map((item) => ({ id: item.institution_id, name: item.institution_name }))) : [],
    courses: wide ? unique(items.filter((item) => isAdmin || item.institution_id === network).map((item) => ({ id: item.course_id, name: item.course_name, institutionId: item.institution_id }))) : [],
    classes: items.map((item) => ({ id: item.class_id, name: item.class_name, courseId: item.course_id, courseName: item.course_name, institutionId: item.institution_id, teaches: teaches.has(item.class_id) })),
  };
}
