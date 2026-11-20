import type { Request } from "express";
import { eq, sql } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { institutionProfiles, universities } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { feedbackSummary } from "../chat/chatFeedbackService";
import { institutionConcepts } from "../concepts/conceptProficiencyService";
import { featuresFor, featuresForInstitutions } from "../features/featureService";
import { geocodeAddress } from "./geocoder";
import { lookupPostalCode } from "./postalCode";
import { imagePath, removeImageIfUnused, storeImage } from "./institutionImageStore";
import { isOwner } from "../sandbox/sandboxConfig";

/**
 * Institution page. Each profile sees only its own part of the institution (details at `institutionPage`):
 * the student their class, the professor the classes they teach, the coordination the courses it
 * coordinates, the admin everything and the editing, the owner also turning the institution and its
 * page components (location, profile photo) off and on.
 *
 * The location (address and map point) and the profile photo are components the owner can turn off,
 * for one institution or for all: then they are neither shown, nor returned, nor edited.
 */
export const MIN_GROUP = 5;
export const LINK_KINDS = ["instagram", "facebook", "youtube", "linkedin", "blog", "site"] as const;
const MAX_LINKS = 8;
/**
 * Kinds the academic structure covers today (institution → course → classes and subjects). Schools
 * split by grade (fundamental/médio) and classes that move up each year are planned, not covered yet.
 */
export const KINDS = ["universidade", "faculdade", "instituto", "escola_tecnica"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITS = { short: 80, address: 160, postalCode: 20, website: 200, about: 600 };
const LOCATION_FIELDS = ["city", "state", "country", "address", "addressNumber", "district", "postalCode", "latitude", "longitude"] as const;
const IMAGE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;
const IMAGE_MAX = { logo: 300 * 1024, cover: 1536 * 1024 };

type User = NonNullable<Request["user"]>;
export type ViewerLevel = "student" | "professor" | "coordinator" | "admin";

export function viewerLevel(user: Pick<User, "role">): ViewerLevel {
  if (user.role.includes("admin")) return "admin";
  if (user.role.includes("course-coordinator")) return "coordinator";
  if (user.role.includes("professor")) return "professor";
  return "student";
}
/** Small groups never show their exact size. */
const safeCount = (value: number) => (value < MIN_GROUP ? null : value);
const share = (part: number, total: number) => (total >= MIN_GROUP ? Math.round((part / total) * 1000) / 1000 : null);

/* ── Status ─────────────────────────────────────────────────────────────── */

/** Institutions without a profile row are active (nothing changes for existing data). */
export async function isInstitutionActive(db: AnyDbClient, universityId: string | null | undefined): Promise<boolean> {
  if (!universityId || !UUID.test(universityId)) return true;
  const [row] = await db.select({ active: institutionProfiles.active }).from(institutionProfiles).where(eq(institutionProfiles.universityId, universityId)).limit(1);
  return row ? row.active : true;
}

/** Members of a deactivated institution cannot use the platform; admins always can (to turn it back on). */
export async function assertInstitutionActiveFor(db: AnyDbClient, account: { roles?: string[]; role?: string[]; schoolId?: string | null; school?: string | null }) {
  const roles = account.roles ?? account.role ?? [];
  if (roles.indexOf("admin") !== -1) return;
  if (!(await isInstitutionActive(db, account.schoolId ?? account.school))) throw new AppError("auth.institutionInactive", 403);
}

export async function setInstitutionStatus(db: AnyDbClient, user: User, universityId: string, body: unknown) {
  if (!isOwner(user)) throw new AppError("auth.accessDeniedCapital", 403);
  await requireInstitution(db, universityId);
  const active = body && typeof body === "object" ? (body as Record<string, unknown>).active : undefined;
  if (typeof active !== "boolean") throw new AppError("institutions.statusInvalid", 400);
  const now = new Date();
  await db.insert(institutionProfiles)
    .values({ universityId, active, deactivatedAt: active ? null : now, deactivatedBy: active ? null : user.id, updatedAt: now })
    .onConflictDoUpdate({ target: institutionProfiles.universityId, set: { active, deactivatedAt: active ? null : now, deactivatedBy: active ? null : user.id, updatedAt: now } });
  return { active, deactivatedAt: active ? null : now.toISOString() };
}

/* ── Data and images (admin) ────────────────────────────────────────────── */

async function requireInstitution(db: AnyDbClient, universityId: string) {
  if (!UUID.test(universityId)) throw new AppError("institutions.notFound", 404);
  const [row] = await db.select({ id: universities.id, name: universities.name }).from(universities).where(eq(universities.id, universityId)).limit(1);
  if (!row) throw new AppError("institutions.notFound", 404);
  return row;
}

/** Page components released for the institution (rules of the institution, or the global one). */
export async function institutionComponents(db: AnyDbClient, universityId: string) {
  const released = (await featuresForInstitutions(db, [universityId])).get(universityId)!;
  return { location: released.institution_location, photo: released.institution_photo };
}

export interface FieldIssue { field: string; code: string; params?: Record<string, number> }
export class InstitutionValidationError extends AppError {
  constructor(public readonly issues: FieldIssue[]) { super("institutions.invalid", 400); }
}

const optionalText = (raw: Record<string, unknown>, field: string, max: number, issues: FieldIssue[]) => {
  const value = raw[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") { issues.push({ field, code: "INVALID" }); return null; }
  const trimmed = value.trim();
  if (trimmed.length > max) issues.push({ field, code: "TOO_LONG", params: { max } });
  return trimmed || null;
};

/** http(s) address with a real host; without a scheme, https is assumed. Anything else is refused. */
function normalizeUrl(value: string): string | null {
  const text = /^https?:\/\//i.test(value) ? value : "https://" + value;
  try {
    const url = new URL(text);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !/\./.test(url.hostname) || url.username || url.password) return null;
    return text;
  } catch {
    return null;
  }
}

/** Social networks and other sites (optional, up to MAX_LINKS). An Instagram "@name" becomes its address. */
function parseLinks(value: unknown, issues: FieldIssue[]) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) { issues.push({ field: "links", code: "INVALID" }); return null; }
  if (value.length > MAX_LINKS) { issues.push({ field: "links", code: "TOO_MANY", params: { max: MAX_LINKS } }); return null; }
  const links: Array<{ kind: string; url: string }> = [];
  value.forEach((item, index) => {
    const entry = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const kind = typeof entry.kind === "string" && (LINK_KINDS as readonly string[]).indexOf(entry.kind) !== -1 ? entry.kind : null;
    let text = typeof entry.url === "string" ? entry.url.trim() : "";
    if (!text) return; // empty rows are just ignored
    if (!kind) { issues.push({ field: `links.${index}`, code: "INVALID" }); return; }
    if (text.length > LIMITS.website) { issues.push({ field: `links.${index}`, code: "TOO_LONG", params: { max: LIMITS.website } }); return; }
    if (kind === "instagram" && /^@[\w.]{1,30}$/.test(text)) text = `instagram.com/${text.slice(1)}`;
    const url = normalizeUrl(text);
    if (!url) { issues.push({ field: `links.${index}`, code: "INVALID" }); return; }
    links.push({ kind, url });
  });
  return links.length ? links : null;
}

export function parseInstitutionData(body: unknown) {
  const raw = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const issues: FieldIssue[] = [];
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) issues.push({ field: "name", code: "REQUIRED" });
  else if (name.length > 120) issues.push({ field: "name", code: "TOO_LONG", params: { max: 120 } });
  const kind = raw.kind === undefined || raw.kind === null || raw.kind === "" ? null : raw.kind;
  if (kind !== null && (KINDS as readonly unknown[]).indexOf(kind) === -1) issues.push({ field: "kind", code: "INVALID" });
  let website = optionalText(raw, "website", LIMITS.website, issues);
  if (website) {
    website = normalizeUrl(website);
    if (!website) issues.push({ field: "website", code: "INVALID" });
  }
  const links = parseLinks(raw.links, issues);
  // Map point: both coordinates or none.
  const coordinate = (field: "latitude" | "longitude", limit: number) => {
    const value = raw[field];
    if (value === undefined || value === null || value === "") return null;
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
    if (!Number.isFinite(number) || Math.abs(number) > limit) { issues.push({ field, code: "INVALID" }); return null; }
    return Math.round(number * 1e6) / 1e6;
  };
  const latitude = coordinate("latitude", 90);
  const longitude = coordinate("longitude", 180);
  if ((latitude === null) !== (longitude === null) && !issues.some((issue) => issue.field === "latitude" || issue.field === "longitude"))
    issues.push({ field: latitude === null ? "latitude" : "longitude", code: "PAIR" });
  const data = {
    name,
    kind: kind as string | null,
    city: optionalText(raw, "city", LIMITS.short, issues),
    state: optionalText(raw, "state", LIMITS.short, issues),
    country: optionalText(raw, "country", LIMITS.short, issues),
    address: optionalText(raw, "address", LIMITS.address, issues),
    addressNumber: optionalText(raw, "addressNumber", LIMITS.postalCode, issues),
    district: optionalText(raw, "district", LIMITS.short, issues),
    postalCode: optionalText(raw, "postalCode", LIMITS.postalCode, issues),
    latitude,
    longitude,
    website,
    links,
    about: optionalText(raw, "about", LIMITS.about, issues),
  };
  if (issues.length) throw new InstitutionValidationError(issues);
  return data;
}

/** Admins edit (they hire the service); the owner is an admin too. */
export function canEditInstitution(user: User, _universityId: string) {
  return viewerLevel(user) === "admin";
}

export async function updateInstitution(db: AnyDbClient, user: User, universityId: string, body: unknown) {
  if (!canEditInstitution(user, universityId)) throw new AppError("auth.accessDeniedCapital", 403);
  await requireInstitution(db, universityId);
  const { name, ...parsed } = parseInstitutionData(body);
  // With the location turned off, what was saved before stays as it is.
  const components = await institutionComponents(db, universityId);
  const profile: Partial<typeof parsed> = { ...parsed };
  if (!components.location) for (const field of LOCATION_FIELDS) delete profile[field];
  else if (profile.latitude === null && profile.longitude === null && profile.address) {
    const point = await pointFor(profile);
    if (point) { profile.latitude = point.latitude; profile.longitude = point.longitude; }
  }
  const now = new Date();
  await db.update(universities).set({ name, updatedAt: now }).where(eq(universities.id, universityId));
  await db.insert(institutionProfiles).values({ universityId, ...profile, updatedAt: now })
    .onConflictDoUpdate({ target: institutionProfiles.universityId, set: { ...profile, updatedAt: now } });
  return { ok: true };
}

/**
 * With a street address and no map point, the point is looked up when saving (full address first,
 * then without number and CEP). Best effort: if the search fails, the data is saved without it.
 */
async function pointFor(place: { address?: string | null; addressNumber?: string | null; district?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null }) {
  const join = (parts: Array<string | null | undefined>) => parts.filter(Boolean).join(", ");
  const attempts = [
    join([join([place.address, place.addressNumber]), place.district, place.city, place.state, place.postalCode, place.country]),
    join([place.address, place.city, place.state, place.country]),
  ].filter((query, index, all) => query.length >= 3 && all.indexOf(query) === index);
  for (const query of attempts) {
    try {
      const [first] = await geocodeAddress(query);
      if (first) return first;
    } catch {
      return null;
    }
  }
  return null;
}

/** First bytes of each accepted image format. */
function matchesSignature(type: "png" | "jpeg" | "webp", head: Buffer) {
  if (type === "png") return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "jpeg") return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  return head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP";
}

/** Logo and cover as data URLs (PNG, JPEG or WebP). `null` removes the image. */
export async function updateInstitutionImage(db: AnyDbClient, user: User, universityId: string, kind: "logo" | "cover", body: unknown) {
  if (!canEditInstitution(user, universityId)) throw new AppError("auth.accessDeniedCapital", 403);
  await requireInstitution(db, universityId);
  if (kind === "logo" && !(await institutionComponents(db, universityId)).photo) throw new AppError("features.unavailable", 403);
  const image = body && typeof body === "object" ? (body as Record<string, unknown>).image : undefined;
  let value: string | null = null;
  if (image !== null) {
    const match = typeof image === "string" ? IMAGE.exec(image) : null;
    if (!match) throw new AppError("institutions.imageInvalid", 400);
    const bytes = Math.floor((match[2].length * 3) / 4);
    if (bytes > IMAGE_MAX[kind]) throw new AppError({ key: "institutions.imageTooLarge", params: { max: Math.round(IMAGE_MAX[kind] / 1024) } }, 413);
    // The declared type is not enough: the content must start like a real PNG, JPEG or WebP file.
    if (!matchesSignature(match[1] as "png" | "jpeg" | "webp", Buffer.from(match[2].slice(0, 24), "base64"))) throw new AppError("institutions.imageInvalid", 400);
    // The file goes to the image volume; the database keeps only its reference.
    value = await storeImage(match[1] as "png" | "jpeg" | "webp", Buffer.from(match[2], "base64"));
  }
  const [previous] = await db.select({ logo: institutionProfiles.logo, cover: institutionProfiles.cover }).from(institutionProfiles).where(eq(institutionProfiles.universityId, universityId)).limit(1);
  const now = new Date();
  await db.insert(institutionProfiles).values({ universityId, [kind]: value, updatedAt: now })
    .onConflictDoUpdate({ target: institutionProfiles.universityId, set: { [kind]: value, updatedAt: now } });
  if (previous && previous[kind] !== value) await removeImageIfUnused(previous[kind], (reference) => imageInUse(db, reference));
  return { ok: true };
}

async function imageInUse(db: AnyDbClient, reference: string) {
  const rows = (await db.execute(sql`SELECT 1 FROM institution_profiles WHERE logo = ${reference} OR cover = ${reference} LIMIT 1`)).rows;
  return rows.length > 0;
}

/**
 * Address of a stored image for the pages. Older rows still holding the image inside the database are
 * moved to the image volume the first time they are read.
 */
async function publicImage(db: AnyDbClient, universityId: string, kind: "logo" | "cover", value: string | null | undefined) {
  const match = value ? IMAGE.exec(value) : null;
  if (match) {
    try {
      const reference = await storeImage(match[1] as "png" | "jpeg" | "webp", Buffer.from(match[2], "base64"));
      await db.update(institutionProfiles).set({ [kind]: reference }).where(eq(institutionProfiles.universityId, universityId));
      return imagePath(reference);
    } catch {
      return value ?? null;
    }
  }
  return imagePath(value);
}

/** Map point for an address, for whoever edits the institution (location component released). */
export async function geocodeForInstitution(db: AnyDbClient, user: User, universityId: string, query: unknown, language?: string) {
  if (!canEditInstitution(user, universityId)) throw new AppError("auth.accessDeniedCapital", 403);
  await requireInstitution(db, universityId);
  if (!(await institutionComponents(db, universityId)).location) throw new AppError("features.unavailable", 403);
  return geocodeAddress(query, language);
}

/** Address of a Brazilian postal code (CEP), for whoever edits the institution (location released). */
export async function postalCodeForInstitution(db: AnyDbClient, user: User, universityId: string, code: unknown) {
  if (!canEditInstitution(user, universityId)) throw new AppError("auth.accessDeniedCapital", 403);
  await requireInstitution(db, universityId);
  if (!(await institutionComponents(db, universityId)).location) throw new AppError("features.unavailable", 403);
  return lookupPostalCode(code);
}

/* ── The page ───────────────────────────────────────────────────────────── */

/** Institutions the person may open: admins every one of their database, the others only their own. */
export async function listInstitutions(db: AnyDbClient, user: User) {
  const level = viewerLevel(user);
  const scope = level === "admin" ? sql`TRUE` : user.school && UUID.test(user.school) ? sql`u.id = ${user.school}` : sql`FALSE`;
  const rows = (await db.execute(sql`
    SELECT u.id, u.name, p.kind, p.city, p.state, p.logo, COALESCE(p.active, TRUE) AS active,
      (SELECT count(*)::int FROM courses c WHERE c.university_id = u.id) AS courses,
      (SELECT count(*)::int FROM classes k JOIN courses c ON c.id = k.course_id WHERE c.university_id = u.id) AS classes
    FROM universities u LEFT JOIN institution_profiles p ON p.university_id = u.id
    WHERE ${scope}
    ORDER BY u.name`)).rows as Array<{ id: string; name: string; kind: string | null; city: string | null; state: string | null; logo: string | null; active: boolean; courses: number; classes: number }>;
  const components = await featuresForInstitutions(db, rows.map((row) => row.id));
  for (const row of rows) row.logo = components.get(row.id)!.institution_photo ? await publicImage(db, row.id, "logo", row.logo) : null;
  return rows.map((row) => {
    const released = components.get(row.id)!;
    return {
    id: row.id, name: row.name, kind: row.kind,
    city: released.institution_location ? row.city : null, state: released.institution_location ? row.state : null,
    logo: released.institution_photo ? row.logo : null, // turned into its address below
    active: row.active, courses: Number(row.courses), classes: Number(row.classes),
    };
  });
}

type Run = <T>(query: ReturnType<typeof sql>) => Promise<T[]>;
const uuidList = (list: string[]) => sql.join(list.map((value) => sql`${value}::uuid`), sql`, `);
/** Courses a coordinator answers for (their "faculdade"), inside the institution. */
const coordinatedCourses = (user: User) => (Array.isArray(user.courses) ? user.courses : user.courses ? [user.courses] : []).filter((value): value is string => typeof value === "string" && UUID.test(value));

/** Students active in each of the last 7 weeks (the current one included), among the students matched by `students`. */
async function weeklyActive(run: Run, students: ReturnType<typeof sql>, now: Date) {
  const weekStart = new Date(now.getTime() - 6 * 7 * 86400000);
  const rows = await run<{ week: string; active: number }>(sql`
    SELECT to_char(date_trunc('week', s.session_start), 'YYYY-MM-DD') AS week, count(DISTINCT ua.user_id)::int AS active
    FROM analysis_sessions s JOIN user_analyses ua ON ua.id = s.analysis_id JOIN student_profiles sp ON sp.account_id = ua.user_id
    WHERE ${students} AND s.session_start >= date_trunc('week', ${weekStart}::timestamptz)
    GROUP BY 1 ORDER BY 1`);
  return Array.from({ length: 7 }, (_item, index) => {
    const day = new Date(weekStart.getTime() + index * 7 * 86400000);
    const monday = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - ((day.getUTCDay() + 6) % 7)));
    const key = monday.toISOString().slice(0, 10);
    const found = rows.find((row) => row.week === key);
    return { week: key, active: found ? Number(found.active) : 0 };
  });
}

/**
 * Student: only their own class. Its subjects with the professor in charge of each, and the
 * classmates' names (no e-mail, no results).
 */
async function classView(run: Run, user: User, universityId: string) {
  const [own] = await run<{ id: string; name: string; course: string }>(sql`
    SELECT k.id, k.name, c.name AS course FROM student_profiles sp JOIN classes k ON k.id = sp.class_id JOIN courses c ON c.id = k.course_id
    WHERE sp.account_id = ${user.id} AND c.university_id = ${universityId} LIMIT 1`);
  if (!own) return null;
  const subjects = await run<{ id: string; name: string }>(sql`
    SELECT d.id, d.name FROM class_disciplines cd JOIN disciplines d ON d.id = cd.discipline_id WHERE cd.class_id = ${own.id} ORDER BY d.name`);
  const staff = subjects.length ? await run<{ discipline_id: string; name: string; teaches: boolean }>(sql`
    SELECT pd.discipline_id, a.name, EXISTS (SELECT 1 FROM professor_classes pc WHERE pc.professor_id = a.id AND pc.class_id = ${own.id}) AS teaches
    FROM professor_disciplines pd JOIN accounts a ON a.id = pd.professor_id AND a.status = 'active'
    JOIN professor_profiles pp ON pp.account_id = a.id AND pp.school_id = ${universityId}
    WHERE pd.discipline_id IN (${uuidList(subjects.map((item) => item.id))})
    ORDER BY a.name`) : [];
  const classmates = await run<{ name: string }>(sql`
    SELECT a.name FROM student_profiles sp JOIN accounts a ON a.id = sp.account_id AND a.status = 'active'
    WHERE sp.class_id = ${own.id} AND sp.account_id <> ${user.id} ORDER BY a.name`);
  return {
    id: own.id, name: own.name, course: own.course,
    disciplines: subjects.map((subject) => {
      const linked = staff.filter((row) => row.discipline_id === subject.id);
      // In charge: who teaches the subject in this class; without that link, whoever teaches the subject.
      const inCharge = linked.some((row) => row.teaches) ? linked.filter((row) => row.teaches) : linked;
      return { id: subject.id, name: subject.name, professors: inCharge.map((row) => row.name) };
    }),
    classmates: classmates.map((row) => row.name),
  };
}

/**
 * Professor: only the classes they teach and, for each subject, its students and how many of them
 * were active each week.
 */
async function teachingView(run: Run, user: User, universityId: string, now: Date) {
  const taught = await run<{ id: string; name: string; course: string; students: number }>(sql`
    SELECT k.id, k.name, c.name AS course, (SELECT count(*)::int FROM student_profiles sp WHERE sp.class_id = k.id) AS students
    FROM professor_classes pc JOIN classes k ON k.id = pc.class_id JOIN courses c ON c.id = k.course_id
    WHERE pc.professor_id = ${user.id} AND c.university_id = ${universityId} ORDER BY c.name, k.name`);
  const subjects = await run<{ id: string; name: string; course: string }>(sql`
    SELECT d.id, d.name, c.name AS course FROM professor_disciplines pd JOIN disciplines d ON d.id = pd.discipline_id JOIN courses c ON c.id = d.course_id
    WHERE pd.professor_id = ${user.id} AND c.university_id = ${universityId} ORDER BY d.name, c.name`);
  const disciplines = [];
  for (const subject of subjects) {
    // Classes of the subject the professor teaches; linked only to the subject, every class that has it.
    let classRows = await run<{ id: string; name: string }>(sql`
      SELECT k.id, k.name FROM class_disciplines cd JOIN classes k ON k.id = cd.class_id
      WHERE cd.discipline_id = ${subject.id} AND k.id IN (SELECT class_id FROM professor_classes WHERE professor_id = ${user.id}) ORDER BY k.name`);
    if (!classRows.length && !taught.length)
      classRows = await run<{ id: string; name: string }>(sql`
        SELECT k.id, k.name FROM class_disciplines cd JOIN classes k ON k.id = cd.class_id WHERE cd.discipline_id = ${subject.id} ORDER BY k.name`);
    const classIds = classRows.map((row) => row.id);
    const students = classIds.length ? await run<{ name: string; class_name: string }>(sql`
      SELECT a.name, k.name AS class_name FROM student_profiles sp JOIN accounts a ON a.id = sp.account_id AND a.status = 'active'
      JOIN classes k ON k.id = sp.class_id WHERE sp.class_id IN (${uuidList(classIds)}) ORDER BY k.name, a.name`) : [];
    disciplines.push({
      id: subject.id, name: subject.name, course: subject.course, classes: classRows.map((row) => row.name),
      students: students.map((row) => ({ name: row.name, className: row.class_name })),
      weeks: classIds.length ? await weeklyActive(run, sql`sp.class_id IN (${uuidList(classIds)})`, now) : [],
    });
  }
  return { classes: taught.map((row) => ({ ...row, students: Number(row.students) })), disciplines };
}

/**
 * Coordination (their courses only) and admins (the whole institution): aggregated numbers only,
 * nobody named, groups under MIN_GROUP never show their size.
 */
async function aggregateView(db: AnyDbClient, run: Run, user: User, id: string, level: ViewerLevel, courseIds: string[] | null, now: Date) {
  const inScope = courseIds === null ? sql`TRUE` : courseIds.length ? sql`c.id IN (${uuidList(courseIds)})` : sql`FALSE`;
  const studentScope = courseIds === null ? sql`sp.school_id = ${id}` : courseIds.length ? sql`sp.school_id = ${id} AND sp.course_id IN (${uuidList(courseIds)})` : sql`FALSE`;

  const classRows = await run<{ course_id: string; course_name: string; class_id: string; class_name: string; students: number; active: number; correct: number; wrong: number }>(sql`
    SELECT c.id AS course_id, c.name AS course_name, k.id AS class_id, k.name AS class_name,
      (SELECT count(*)::int FROM student_profiles sp WHERE sp.class_id = k.id) AS students,
      (SELECT count(DISTINCT ua.user_id)::int FROM analysis_sessions s JOIN user_analyses ua ON ua.id = s.analysis_id
         JOIN student_profiles sp ON sp.account_id = ua.user_id
         WHERE sp.class_id = k.id AND s.session_start >= ${new Date(now.getTime() - 7 * 86400000)}) AS active,
      (SELECT COALESCE(sum(ua.total_correct_answers), 0)::int FROM user_analyses ua JOIN student_profiles sp ON sp.account_id = ua.user_id WHERE sp.class_id = k.id) AS correct,
      (SELECT COALESCE(sum(ua.total_wrong_answers), 0)::int FROM user_analyses ua JOIN student_profiles sp ON sp.account_id = ua.user_id WHERE sp.class_id = k.id) AS wrong
    FROM courses c JOIN classes k ON k.course_id = c.id
    WHERE c.university_id = ${id} AND ${inScope}
    ORDER BY c.name, k.name`);
  const courseRows = await run<{ id: string; name: string; disciplines: number }>(sql`
    SELECT c.id, c.name, (SELECT count(*)::int FROM disciplines d WHERE d.course_id = c.id) AS disciplines
    FROM courses c WHERE c.university_id = ${id} AND ${inScope} ORDER BY c.name`);
  const disciplineRows = await run<{ id: string; name: string; course_name: string; classes: number; questions: number; exams: number }>(sql`
    SELECT d.id, d.name, c.name AS course_name,
      (SELECT count(*)::int FROM class_disciplines cd WHERE cd.discipline_id = d.id) AS classes,
      (SELECT count(*)::int FROM assessment_questions q WHERE q.discipline_id = d.id AND q.archived_at IS NULL) AS questions,
      (SELECT count(*)::int FROM exams e WHERE e.discipline_id = d.id AND e.status = 'released') AS exams
    FROM disciplines d JOIN courses c ON c.id = d.course_id
    WHERE c.university_id = ${id} AND ${inScope} ORDER BY c.name, d.name`);

  const students = classRows.reduce((sum, row) => sum + Number(row.students), 0);
  const activeNow = classRows.reduce((sum, row) => sum + Number(row.active), 0);
  const correct = classRows.reduce((sum, row) => sum + Number(row.correct), 0);
  const wrong = classRows.reduce((sum, row) => sum + Number(row.wrong), 0);
  const weeks = await weeklyActive(run, studentScope, now);
  const previous = weeks[weeks.length - 2].active;
  const current = weeks[weeks.length - 1].active;

  const released = await featuresFor(db, user);
  const concepts = await institutionConcepts(db, id, released.practice_parsons ? [] : ["parsons"], MIN_GROUP, now, courseIds ?? undefined);

  // Chat satisfaction covers the whole institution: admins only.
  let chat: { score: number | null; total: number } | null = null;
  if (level === "admin") {
    const summary = await feedbackSummary(db, { days: 30, institutionId: id });
    chat = summary.total >= MIN_GROUP ? { score: summary.score, total: summary.total } : null;
  }

  // Team as counts by role only: nobody is named.
  const staffScope = courseIds === null ? sql`TRUE`
    : courseIds.length ? sql`EXISTS (SELECT 1 FROM professor_courses pc WHERE pc.professor_id = pp.account_id AND pc.course_id IN (${uuidList(courseIds)}))` : sql`FALSE`;
  const [staff] = await run<{ coordinators: number; professors: number }>(sql`
    SELECT count(*) FILTER (WHERE EXISTS (SELECT 1 FROM account_roles r WHERE r.account_id = pp.account_id AND r.role = 'course-coordinator'))::int AS coordinators,
      count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM account_roles r WHERE r.account_id = pp.account_id AND r.role = 'course-coordinator'))::int AS professors
    FROM professor_profiles pp JOIN accounts a ON a.id = pp.account_id
    WHERE pp.school_id = ${id} AND a.status = 'active' AND ${staffScope}`);

  return {
    counts: { courses: courseRows.length, classes: classRows.length, disciplines: disciplineRows.length },
    overview: {
      students: safeCount(students),
      activeShare: share(activeNow, students),
      activeChange: students >= MIN_GROUP ? current - previous : null,
      quizAccuracy: students >= MIN_GROUP && correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 1000) / 1000 : null,
      chatSatisfaction: chat ? chat.score : null,
      weeks: students >= MIN_GROUP ? weeks : [],
      concepts,
    },
    courses: courseRows.map((course) => {
      const own = classRows.filter((row) => row.course_id === course.id);
      const total = own.reduce((sum, row) => sum + Number(row.students), 0);
      const activeCount = own.reduce((sum, row) => sum + Number(row.active), 0);
      return { id: course.id, name: course.name, classes: own.length, disciplines: Number(course.disciplines), students: safeCount(total), activeShare: share(activeCount, total) };
    }),
    classes: classRows.map((row) => {
      const total = Number(row.students);
      const answered = Number(row.correct) + Number(row.wrong);
      return {
        id: row.class_id, name: row.class_name, course: row.course_name, students: safeCount(total), activeShare: share(Number(row.active), total),
        quizAccuracy: total >= MIN_GROUP && answered > 0 ? Math.round((Number(row.correct) / answered) * 1000) / 1000 : null,
      };
    }),
    disciplines: disciplineRows.map((row) => ({
      id: row.id, name: row.name, course: row.course_name, classes: Number(row.classes), questions: Number(row.questions), releasedExams: Number(row.exams),
    })),
    team: { coordinators: Number(staff?.coordinators ?? 0), professors: Number(staff?.professors ?? 0), students: safeCount(students) },
  };
}

/**
 * The page. What each profile gets:
 *   student      `myClass`: their class, its subjects with the professor in charge, classmates' names
 *   professor    `teaching`: the classes they teach, students per subject, active students per week per subject
 *   coordinator  aggregated numbers of the courses they coordinate (their "faculdade")
 *   admin        the same for the whole institution, chat satisfaction, and editing
 * Everyone sees the identity and, when released, the location.
 */
export async function institutionPage(db: AnyDbClient, user: User, universityId: string, now = new Date()) {
  const level = viewerLevel(user);
  // Not found and not allowed look the same, so other institutions are not revealed.
  if (level !== "admin" && universityId !== user.school) throw new AppError("institutions.notFound", 404);
  const base = await requireInstitution(db, universityId);
  const [profile] = await db.select().from(institutionProfiles).where(eq(institutionProfiles.universityId, universityId)).limit(1);
  const active = profile ? profile.active : true;
  if (!active && level !== "admin") throw new AppError("auth.institutionInactive", 403);
  const id = universityId;
  const run: Run = async <T,>(query: ReturnType<typeof sql>) => (await db.execute(query)).rows as unknown as T[];
  const components = await institutionComponents(db, id);
  const place = components.location ? profile : undefined;

  const header = {
    viewer: { level, canEdit: canEditInstitution(user, id), canChangeStatus: isOwner(user), canChangeComponents: isOwner(user) },
    components,
    institution: {
      id, name: base.name, kind: profile?.kind ?? null, city: place?.city ?? null, state: place?.state ?? null, country: place?.country ?? null,
      address: place?.address ?? null, addressNumber: place?.addressNumber ?? null, district: place?.district ?? null, postalCode: place?.postalCode ?? null, latitude: place?.latitude ?? null, longitude: place?.longitude ?? null,
      website: profile?.website ?? null, links: profile?.links ?? [], about: profile?.about ?? null, logo: components.photo ? await publicImage(db, id, "logo", profile?.logo) : null, cover: await publicImage(db, id, "cover", profile?.cover),
      active, deactivatedAt: profile?.deactivatedAt ? profile.deactivatedAt.toISOString() : null,
    },
    minGroupSize: MIN_GROUP,
  };
  if (level === "student") return { ...header, myClass: await classView(run, user, id) };
  if (level === "professor") return { ...header, teaching: await teachingView(run, user, id, now) };
  return { ...header, ...(await aggregateView(db, run, user, id, level, level === "admin" ? null : coordinatedCourses(user), now)) };
}
