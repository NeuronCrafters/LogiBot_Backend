import type { Request } from "express";
import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { assessmentQuestions, disciplines, flashcardDecks, flashcardReviews, flashcards } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { normalizeConcept, QUESTION_LANGUAGES } from "../logic/questionCore";
import { assertProfessorCanManageDiscipline } from "../quiz/quizPermissionService";

/**
 * Flash cards. The staff make decks for a subject (same rule as quizzes and the question bank:
 * professors their own decks, coordination also the decks of coordinated subjects, admins all);
 * students of the classes that have the subject study the published decks. Each student has a
 * Leitner box per card: "again" sends it back to box 1, "hard" keeps it, "good" moves it up.
 */
type User = NonNullable<Request["user"]>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LIMITS = { title: 120, description: 400, front: 500, back: 1000, concept: 40, cards: 200 };
export const RATINGS = ["again", "hard", "good"] as const;
export type Rating = (typeof RATINGS)[number];
/** Days until the next review for each box (box 1 comes back in 10 minutes). */
const INTERVAL_DAYS = [0, 0, 1, 3, 7, 21];
const SESSION_SIZE = 20;

export interface FieldIssue { field: string; code: string; params?: Record<string, number> }
export class FlashcardValidationError extends AppError {
  constructor(public readonly issues: FieldIssue[]) { super("flashcards.invalid", 400); }
}

const isAdmin = (user: User) => user.role.includes("admin");
const coordinated = (user: User) => (user.role.includes("course-coordinator") ? user.disciplines ?? [] : []);
export const canManageDeck = (deck: { ownerId: string; disciplineId: string }, user: User) =>
  isAdmin(user) || deck.ownerId === user.id || coordinated(user).indexOf(deck.disciplineId) !== -1;

/* ── Staff ──────────────────────────────────────────────────────────────── */

export async function listManagedDecks(db: AnyDbClient, user: User, filters: { disciplineId?: unknown }) {
  const conditions: SQL[] = [isNull(flashcardDecks.archivedAt)];
  if (typeof filters.disciplineId === "string" && filters.disciplineId) {
    if (!UUID.test(filters.disciplineId)) return [];
    conditions.push(eq(flashcardDecks.disciplineId, filters.disciplineId));
  }
  if (!isAdmin(user)) {
    const own = eq(flashcardDecks.ownerId, user.id);
    const mine = coordinated(user);
    conditions.push(mine.length ? (or(own, inArray(flashcardDecks.disciplineId, mine)) as SQL) : own);
  }
  const rows = await db
    .select({ deck: flashcardDecks, disciplineName: disciplines.name, cards: sql<number>`(SELECT count(*)::int FROM flashcards f WHERE f.deck_id = ${flashcardDecks.id})` })
    .from(flashcardDecks)
    .innerJoin(disciplines, eq(disciplines.id, flashcardDecks.disciplineId))
    .where(and(...conditions))
    .orderBy(desc(flashcardDecks.updatedAt));
  return rows.map(({ deck, disciplineName, cards }) => ({ ...summary(deck), disciplineName, cards: Number(cards) }));
}

const summary = (deck: typeof flashcardDecks.$inferSelect) => ({
  id: deck.id, disciplineId: deck.disciplineId, title: deck.title, description: deck.description, language: deck.language,
  published: deck.published, updatedAt: deck.updatedAt,
});

async function findDeck(db: AnyDbClient, id: string) {
  if (!UUID.test(id)) throw new AppError("flashcards.notFound", 404);
  const [deck] = await db.select().from(flashcardDecks).where(and(eq(flashcardDecks.id, id), isNull(flashcardDecks.archivedAt))).limit(1);
  if (!deck) throw new AppError("flashcards.notFound", 404);
  return deck;
}

const cardsOf = (db: AnyDbClient, deckId: string) =>
  db.select({ id: flashcards.id, front: flashcards.front, back: flashcards.back, concept: flashcards.concept, sourceQuestionId: flashcards.sourceQuestionId })
    .from(flashcards).where(eq(flashcards.deckId, deckId)).orderBy(asc(flashcards.position));

export async function getManagedDeck(db: AnyDbClient, user: User, id: string) {
  const deck = await findDeck(db, id);
  if (!canManageDeck(deck, user)) throw new AppError("auth.accessDeniedCapital", 403);
  return { ...summary(deck), cards: await cardsOf(db, deck.id) };
}

interface CardInput { id: string | null; front: string; back: string; concept: string | null; sourceQuestionId: string | null }

/** Title, subject, language and 1 to 200 cards with front and back; issues point at each field. */
export function parseDeck(body: unknown) {
  const raw = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const issues: FieldIssue[] = [];
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const title = text(raw.title);
  if (!title) issues.push({ field: "title", code: "REQUIRED" });
  else if (title.length > LIMITS.title) issues.push({ field: "title", code: "TOO_LONG", params: { max: LIMITS.title } });
  const description = text(raw.description);
  if (description.length > LIMITS.description) issues.push({ field: "description", code: "TOO_LONG", params: { max: LIMITS.description } });
  const disciplineId = typeof raw.disciplineId === "string" && UUID.test(raw.disciplineId) ? raw.disciplineId : "";
  if (!disciplineId) issues.push({ field: "disciplineId", code: "REQUIRED" });
  const language = (QUESTION_LANGUAGES as readonly string[]).indexOf(String(raw.language)) !== -1 ? String(raw.language) : "pt-BR";
  const list = Array.isArray(raw.cards) ? raw.cards : [];
  if (!list.length) issues.push({ field: "cards", code: "REQUIRED" });
  if (list.length > LIMITS.cards) issues.push({ field: "cards", code: "TOO_MANY", params: { max: LIMITS.cards } });
  const cards: CardInput[] = list.slice(0, LIMITS.cards).map((item, index) => {
    const entry = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const front = text(entry.front);
    const back = text(entry.back);
    if (!front) issues.push({ field: `cards.${index}.front`, code: "REQUIRED" });
    else if (front.length > LIMITS.front) issues.push({ field: `cards.${index}.front`, code: "TOO_LONG", params: { max: LIMITS.front } });
    if (!back) issues.push({ field: `cards.${index}.back`, code: "REQUIRED" });
    else if (back.length > LIMITS.back) issues.push({ field: `cards.${index}.back`, code: "TOO_LONG", params: { max: LIMITS.back } });
    const concept = text(entry.concept) ? normalizeConcept(text(entry.concept)) : null;
    if (concept && concept.length > LIMITS.concept) issues.push({ field: `cards.${index}.concept`, code: "TOO_LONG", params: { max: LIMITS.concept } });
    return {
      id: typeof entry.id === "string" && UUID.test(entry.id) ? entry.id : null,
      front, back, concept,
      sourceQuestionId: typeof entry.sourceQuestionId === "string" && UUID.test(entry.sourceQuestionId) ? entry.sourceQuestionId : null,
    };
  });
  if (issues.length) throw new FlashcardValidationError(issues);
  return { title, description: description || null, disciplineId, language, published: raw.published === true, cards };
}

/**
 * Saves the deck and its cards in one go. Cards that keep their id keep the students' progress;
 * removed cards (and their progress) go away.
 */
export async function saveDeck(db: AnyDbClient, user: User, id: string | null, body: unknown) {
  const data = parseDeck(body);
  await assertProfessorCanManageDiscipline(user, data.disciplineId);
  const now = new Date();
  let deckId = id;
  if (id) {
    const current = await findDeck(db, id);
    if (!canManageDeck(current, user)) throw new AppError("auth.accessDeniedCapital", 403);
    await db.update(flashcardDecks).set({ title: data.title, description: data.description, disciplineId: data.disciplineId, language: data.language, published: data.published, updatedAt: now }).where(eq(flashcardDecks.id, id));
  } else {
    const [created] = await db.insert(flashcardDecks).values({ ownerId: user.id, disciplineId: data.disciplineId, title: data.title, description: data.description, language: data.language, published: data.published }).returning({ id: flashcardDecks.id });
    deckId = created.id;
  }
  const existing = (await db.select({ id: flashcards.id }).from(flashcards).where(eq(flashcards.deckId, deckId!))).map((row) => row.id);
  const kept = data.cards.map((card) => card.id).filter((cardId): cardId is string => !!cardId && existing.indexOf(cardId) !== -1);
  const removed = existing.filter((cardId) => kept.indexOf(cardId) === -1);
  if (removed.length) await db.delete(flashcards).where(inArray(flashcards.id, removed));
  for (const [position, card] of data.cards.entries()) {
    const values = { front: card.front, back: card.back, concept: card.concept, position, sourceQuestionId: card.sourceQuestionId };
    if (card.id && kept.indexOf(card.id) !== -1) await db.update(flashcards).set(values).where(eq(flashcards.id, card.id));
    else await db.insert(flashcards).values({ deckId: deckId!, ...values });
  }
  return getManagedDeck(db, user, deckId!);
}

export async function archiveDeck(db: AnyDbClient, user: User, id: string) {
  const deck = await findDeck(db, id);
  if (!canManageDeck(deck, user)) throw new AppError("auth.accessDeniedCapital", 403);
  await db.update(flashcardDecks).set({ archivedAt: new Date(), published: false, updatedAt: new Date() }).where(eq(flashcardDecks.id, id));
}

/**
 * Quiz questions of the bank that can become cards (statement on the front, correct option on the
 * back). Only questions the person manages, of the chosen subject.
 */
export async function questionCandidates(db: AnyDbClient, user: User, disciplineId: unknown) {
  if (typeof disciplineId !== "string" || !UUID.test(disciplineId)) return [];
  await assertProfessorCanManageDiscipline(user, disciplineId);
  const conditions: SQL[] = [isNull(assessmentQuestions.archivedAt), eq(assessmentQuestions.disciplineId, disciplineId), eq(assessmentQuestions.type, "quiz")];
  if (!isAdmin(user) && coordinated(user).indexOf(disciplineId) === -1) conditions.push(eq(assessmentQuestions.ownerId, user.id));
  const rows = await db.select({ id: assessmentQuestions.id, statement: assessmentQuestions.statement, content: assessmentQuestions.content, concepts: assessmentQuestions.concepts })
    .from(assessmentQuestions).where(and(...conditions)).orderBy(desc(assessmentQuestions.updatedAt));
  return rows.flatMap((row) => {
    const content = row.content as { options?: unknown; correct?: unknown };
    const options = Array.isArray(content.options) ? content.options : [];
    const answer = typeof content.correct === "number" ? options[content.correct] : undefined;
    if (typeof answer !== "string" || !answer.trim()) return [];
    return [{ id: row.id, front: row.statement.slice(0, LIMITS.front), back: answer.slice(0, LIMITS.back), concept: (row.concepts ?? [])[0] ?? null }];
  });
}

/* ── Students ───────────────────────────────────────────────────────────── */

/** Subjects of the student's class: only their published decks can be studied. */
async function studentDisciplines(db: AnyDbClient, user: User): Promise<string[]> {
  const rows = (await db.execute(sql`
    SELECT cd.discipline_id FROM student_profiles sp JOIN class_disciplines cd ON cd.class_id = sp.class_id WHERE sp.account_id = ${user.id}`)).rows as Array<{ discipline_id: string }>;
  return rows.map((row) => row.discipline_id);
}

async function studyableDeck(db: AnyDbClient, user: User, deckId: string) {
  const deck = await findDeck(db, deckId);
  if (!deck.published || (await studentDisciplines(db, user)).indexOf(deck.disciplineId) === -1) throw new AppError("flashcards.notFound", 404);
  return deck;
}

export async function listStudyDecks(db: AnyDbClient, user: User, now = new Date()) {
  const subjects = await studentDisciplines(db, user);
  if (!subjects.length) return [];
  const rows = (await db.execute(sql`
    SELECT d.id, d.title, d.description, d.language, s.name AS discipline_name,
      count(f.id)::int AS cards,
      count(f.id) FILTER (WHERE r.card_id IS NULL OR r.due_at <= ${now})::int AS due,
      count(f.id) FILTER (WHERE r.box >= 4)::int AS known,
      count(f.id) FILTER (WHERE r.card_id IS NOT NULL)::int AS seen
    FROM flashcard_decks d
    JOIN disciplines s ON s.id = d.discipline_id
    LEFT JOIN flashcards f ON f.deck_id = d.id
    LEFT JOIN flashcard_reviews r ON r.card_id = f.id AND r.student_id = ${user.id}
    WHERE d.published AND d.archived_at IS NULL AND d.discipline_id IN (${sql.join(subjects.map((id) => sql`${id}::uuid`), sql`, `)})
    GROUP BY d.id, s.name
    HAVING count(f.id) > 0
    ORDER BY s.name, d.title`)).rows as Array<{ id: string; title: string; description: string | null; language: string; discipline_name: string; cards: number; due: number; known: number; seen: number }>;
  return rows.map((row) => ({
    id: row.id, title: row.title, description: row.description, language: row.language, disciplineName: row.discipline_name,
    cards: Number(row.cards), due: Number(row.due), known: Number(row.known), seen: Number(row.seen),
  }));
}

/**
 * Cards for one study round: those due first (new and the hardest), up to 20. With nothing due, the
 * student can still practise ahead with the ones coming back soonest.
 */
export async function studySession(db: AnyDbClient, user: User, deckId: string, now = new Date()) {
  const deck = await studyableDeck(db, user, deckId);
  const rows = (await db.execute(sql`
    SELECT f.id, f.front, f.back, f.concept, COALESCE(r.box, 0) AS box, r.due_at
    FROM flashcards f LEFT JOIN flashcard_reviews r ON r.card_id = f.id AND r.student_id = ${user.id}
    WHERE f.deck_id = ${deck.id}
    ORDER BY (r.card_id IS NULL OR r.due_at <= ${now}) DESC, COALESCE(r.box, 0), r.due_at NULLS FIRST, f.position`)).rows as Array<{ id: string; front: string; back: string; concept: string | null; box: number; due_at: Date | null }>;
  const due = rows.filter((row) => row.due_at === null || new Date(row.due_at) <= now);
  const chosen = (due.length ? due : rows).slice(0, SESSION_SIZE);
  return {
    deck: { id: deck.id, title: deck.title, language: deck.language },
    ahead: due.length === 0,
    total: rows.length,
    due: due.length,
    cards: chosen.map((row) => ({ id: row.id, front: row.front, back: row.back, concept: row.concept, box: Number(row.box) })),
  };
}

export function nextReview(box: number, rating: Rating, now: Date) {
  const next = rating === "again" ? 1 : rating === "hard" ? Math.max(1, box) : Math.min(5, Math.max(1, box) + 1);
  const minutes = rating === "again" ? 10 : rating === "hard" ? Math.max(10, (INTERVAL_DAYS[next] * 24 * 60) / 2) : Math.max(10, INTERVAL_DAYS[next] * 24 * 60);
  return { box: next, dueAt: new Date(now.getTime() + minutes * 60000) };
}

export async function reviewCard(db: AnyDbClient, user: User, cardId: string, body: unknown, now = new Date()) {
  if (!UUID.test(cardId)) throw new AppError("flashcards.notFound", 404);
  const rating = body && typeof body === "object" ? (body as Record<string, unknown>).rating : undefined;
  if (typeof rating !== "string" || (RATINGS as readonly string[]).indexOf(rating) === -1) throw new AppError("flashcards.ratingInvalid", 400);
  const [card] = await db.select({ id: flashcards.id, deckId: flashcards.deckId }).from(flashcards).where(eq(flashcards.id, cardId)).limit(1);
  if (!card) throw new AppError("flashcards.notFound", 404);
  await studyableDeck(db, user, card.deckId);
  const [current] = await db.select().from(flashcardReviews).where(and(eq(flashcardReviews.studentId, user.id), eq(flashcardReviews.cardId, cardId))).limit(1);
  const next = nextReview(current?.box ?? 0, rating as Rating, now);
  const values = { box: next.box, dueAt: next.dueAt, lastRating: rating, updatedAt: now };
  await db.insert(flashcardReviews)
    .values({ studentId: user.id, cardId, ...values, reviews: 1, correct: rating === "good" ? 1 : 0 })
    .onConflictDoUpdate({
      target: [flashcardReviews.studentId, flashcardReviews.cardId],
      set: { ...values, reviews: sql`${flashcardReviews.reviews} + 1`, correct: sql`${flashcardReviews.correct} + ${rating === "good" ? 1 : 0}` },
    });
  return { box: next.box, dueAt: next.dueAt.toISOString() };
}
