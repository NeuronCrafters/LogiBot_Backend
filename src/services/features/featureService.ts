import type { NextFunction, Request, Response } from "express";
import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { getDb } from "../../db/client";
import { getAccountById } from "../../db/repositories/authRepository";
import { classes, courses, featureRules, universities } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { currentEnvironment, runInEnvironment } from "../../db/environment";

/** Features that can be hidden and blocked. Keep in sync with the frontend catalog. */
export const FEATURES = [
  "chat",
  "quiz",
  "practice_truth_table",
  "practice_translation",
  "practice_parsons",
  "practice_hints",
  "exams",
  "question_bank",
  "feedback",
  "rag",
  "notifications",
  "notifications_email",
  "dashboard",
  "dashboard_comparison",
  "concept_panel",
  "institution_page",
  "institution_location",
  "institution_photo",
  "flashcards",
  "ranking",
] as const;
export type Feature = (typeof FEATURES)[number];
export const SCOPES = ["global", "institution", "course", "class"] as const;
export type Scope = (typeof SCOPES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type FeatureUser = NonNullable<Request["user"]>;
interface Rule { feature: string; scope: string; scopeId: string; enabled: boolean }

const list = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value ? [value] : []).filter((item): item is string => typeof item === "string" && UUID.test(item));

/** Chains of scopes to check for the person, from the most specific to the global one. */
export async function scopeChains(db: AnyDbClient, user: Pick<FeatureUser, "school" | "courses" | "classes">) {
  const school = typeof user.school === "string" && UUID.test(user.school) ? user.school : null;
  const classIds = list(user.classes);
  const courseIds = list(user.courses);
  const tail: Array<[Scope, string]> = [...(school ? [["institution", school] as [Scope, string]] : []), ["global", ""]];
  const chains: Array<Array<[Scope, string]>> = [];
  const coveredCourses: string[] = [];
  if (classIds.length) {
    const rows = await db.select({ id: classes.id, courseId: classes.courseId }).from(classes).where(inArray(classes.id, classIds));
    for (const row of rows) {
      chains.push([["class", row.id], ["course", row.courseId], ...tail]);
      coveredCourses.push(row.courseId);
    }
  }
  for (const courseId of courseIds) if (coveredCourses.indexOf(courseId) === -1) chains.push([["course", courseId], ...tail]);
  if (!chains.length) chains.push(tail);
  return chains;
}

/** First rule found along the chain decides; no rule means released. */
export function resolveChain(rules: Rule[], feature: string, chain: Array<[Scope, string]>): boolean {
  for (const [scope, scopeId] of chain) {
    const rule = rules.find((item) => item.feature === feature && item.scope === scope && item.scopeId === scopeId);
    if (rule) return rule.enabled;
  }
  return true;
}

async function rulesFor(db: AnyDbClient, chains: Array<Array<[Scope, string]>>): Promise<Rule[]> {
  const ids = chains.reduce((all, chain) => all.concat(chain.map(([, id]) => id)), [] as string[]).filter((id) => id);
  const condition = ids.length ? (or(eq(featureRules.scope, "global"), inArray(featureRules.scopeId, ids)) as SQL) : eq(featureRules.scope, "global");
  const columns = { feature: featureRules.feature, scope: featureRules.scope, scopeId: featureRules.scopeId, enabled: featureRules.enabled };
  const own = await db.select(columns).from(featureRules).where(condition);
  if (currentEnvironment() !== "sandbox") return own;
  // The owner's platform-wide switches (made in the real environment) also hold in the test environment,
  // so what is turned off never shows up there. Scoped rules stay per database (other ids).
  const platform = await runInEnvironment("production", () => getDb().select(columns).from(featureRules).where(eq(featureRules.scope, "global")));
  return [...own.filter((rule) => rule.scope !== "global"), ...platform];
}

/**
 * Released features for the person. Everyone follows the rules, admins included: when something is
 * turned off, everything about it disappears for every profile.
 */
export async function featuresFor(db: AnyDbClient, user: FeatureUser): Promise<Record<Feature, boolean>> {
  const result = {} as Record<Feature, boolean>;
  const chains = await scopeChains(db, user);
  const rules = await rulesFor(db, chains);
  // Several classes or courses (professors): released in any of them is enough.
  for (const feature of FEATURES) result[feature] = chains.some((chain) => resolveChain(rules, feature, chain));
  return result;
}

/**
 * Components of an institution's own page (location, profile photo): they follow the rules of that
 * institution (or the global one), whoever is looking at it.
 */
export async function featuresForInstitutions(db: AnyDbClient, universityIds: string[]): Promise<Map<string, Record<Feature, boolean>>> {
  const chains = universityIds.map((id): Array<[Scope, string]> => [["institution", id], ["global", ""]]);
  const rules = await rulesFor(db, chains);
  const result = new Map<string, Record<Feature, boolean>>();
  universityIds.forEach((id, index) => {
    const released = {} as Record<Feature, boolean>;
    for (const feature of FEATURES) released[feature] = resolveChain(rules, feature, chains[index]);
    result.set(id, released);
  });
  return result;
}

/**
 * What is turned on for the whole platform (global rules only), for the public pages: the home page
 * only presents what exists. No institution, course or class is revealed.
 */
export async function platformFeatures(db: AnyDbClient): Promise<Record<Feature, boolean>> {
  const rules = await rulesFor(db, []);
  const result = {} as Record<Feature, boolean>;
  for (const feature of FEATURES) result[feature] = resolveChain(rules, feature, [["global", ""]]);
  return result;
}

/** Features of one place (class, course or institution), from its most specific rule to the global one. */
export async function featuresForChain(db: AnyDbClient, chain: Array<[Scope, string]>): Promise<Record<Feature, boolean>> {
  const full: Array<[Scope, string]> = [...chain, ["global", ""]];
  const rules = await rulesFor(db, [full]);
  const result = {} as Record<Feature, boolean>;
  for (const feature of FEATURES) result[feature] = resolveChain(rules, feature, full);
  return result;
}

/** Workbench exercise types whose feature is turned off: they leave no trace in panels and charts. */
export function hiddenPracticeTypes(released: Record<Feature, boolean>): string[] {
  return (Object.keys(PRACTICE_FEATURE) as string[]).filter((type) => !released[PRACTICE_FEATURE[type]]);
}

/** Blocks the API too, not only the menu. Must run after requireAuth. */
export function requireFeature(feature: Feature | ((req: Request) => Feature | null)) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const key = typeof feature === "function" ? feature(req) : feature;
      if (!key || !req.user) return next();
      const released = await featuresFor(getDb(), req.user);
      if (!released[key]) throw new AppError("features.unavailable", 403);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

const PRACTICE_FEATURE: Record<string, Feature> = { truth_table: "practice_truth_table", translation: "practice_translation", parsons: "practice_parsons" };
/** Workbench requests carry the exercise type in the query (listing) or the body (attempt). */
export const practiceFeature = (req: Request): Feature | null => {
  const type = typeof req.query?.type === "string" ? req.query.type : req.body && typeof req.body.type === "string" ? req.body.type : "";
  return PRACTICE_FEATURE[type] ?? null;
};

/* ── Admin ────────────────────────────────────────────────────────────────── */

export async function listRules(db: AnyDbClient) {
  return db.select().from(featureRules);
}

async function assertScope(db: AnyDbClient, scope: Scope, scopeId: string) {
  if (scope === "global") return;
  if (!UUID.test(scopeId)) throw new AppError("features.scopeNotFound", 404);
  const table = scope === "institution" ? universities : scope === "course" ? courses : classes;
  const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, scopeId)).limit(1);
  if (!row) throw new AppError("features.scopeNotFound", 404);
}

function parseTarget(body: Record<string, unknown>) {
  if (typeof body.feature !== "string" || (FEATURES as readonly string[]).indexOf(body.feature) === -1) throw new AppError("features.featureInvalid", 400);
  if (typeof body.scope !== "string" || (SCOPES as readonly string[]).indexOf(body.scope) === -1) throw new AppError("features.scopeInvalid", 400);
  const scope = body.scope as Scope;
  const scopeId = scope === "global" ? "" : typeof body.scopeId === "string" ? body.scopeId : "";
  return { feature: body.feature as Feature, scope, scopeId };
}

export async function setRule(db: AnyDbClient, adminId: string, body: unknown) {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const target = parseTarget(value);
  if (typeof value.enabled !== "boolean") throw new AppError("features.enabledInvalid", 400);
  await assertScope(db, target.scope, target.scopeId);
  const [saved] = await db
    .insert(featureRules)
    .values({ ...target, enabled: value.enabled, updatedBy: adminId })
    .onConflictDoUpdate({ target: [featureRules.feature, featureRules.scope, featureRules.scopeId], set: { enabled: value.enabled, updatedBy: adminId, updatedAt: new Date() } })
    .returning();
  return saved;
}

/** Removing a rule makes the scope inherit again from the level above. */
export async function clearRule(db: AnyDbClient, body: unknown) {
  const target = parseTarget(body && typeof body === "object" ? (body as Record<string, unknown>) : {});
  await db.delete(featureRules).where(and(eq(featureRules.feature, target.feature), eq(featureRules.scope, target.scope), eq(featureRules.scopeId, target.scopeId)));
}

/** Released features of an account that is not the one making the request (e.g. a notification recipient). */
export async function featureEnabledForAccount(db: AnyDbClient, accountId: string, feature: Feature): Promise<boolean> {
  const account = await getAccountById(db, accountId);
  if (!account) return false;
  const released = await featuresFor(db, {
    id: account.id, name: account.name, email: account.email, role: account.roles as FeatureUser["role"],
    school: account.schoolId, courses: account.courses?.length ? account.courses : account.courseId, classes: account.classes?.length ? account.classes : account.classId, disciplines: [],
  });
  return released[feature];
}
