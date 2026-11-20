import { randomUUID } from "crypto";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import request from "supertest";
import { nextReview } from "../services/flashcards/flashcardService";

const url = process.env.FLASHCARDS_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;

it("moves cards between the boxes of spaced repetition", () => {
  const now = new Date("2026-11-19T12:00:00Z");
  const days = (date: Date) => Math.round((date.getTime() - now.getTime()) / 86400000);
  expect(nextReview(0, "good", now).box).toBe(2);
  expect(days(nextReview(0, "good", now).dueAt)).toBe(1);
  expect(nextReview(4, "good", now)).toMatchObject({ box: 5 });
  expect(days(nextReview(4, "good", now).dueAt)).toBe(21);
  expect(nextReview(5, "good", now).box).toBe(5);
  expect(nextReview(4, "again", now).box).toBe(1);
  expect(nextReview(4, "again", now).dueAt.getTime() - now.getTime()).toBe(10 * 60000);
  expect(nextReview(3, "hard", now).box).toBe(3);
  expect(days(nextReview(3, "hard", now).dueAt)).toBe(2); // half of 3 days, rounded
});

integration("flash cards on PostgreSQL", () => {
  let pool: Pool;
  let app: import("express").Express;
  let client: typeof import("../db/client");
  const ids = { school: randomUUID(), course: randomUUID(), classA: randomUUID(), classB: randomUUID(), logic: randomUUID(), other: randomUUID(), question: randomUUID() };
  const people = { professor: randomUUID(), stranger: randomUUID(), coordinator: randomUUID(), studentA: randomUUID(), studentB: randomUUID() };
  const password = "senha-de-teste-123";
  const email = (id: string) => `${id}@example.invalid`;
  let deckId = "";
  let cardIds: string[] = [];

  beforeAll(async () => {
    if (!url!.includes("_flashcards_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated flashcards test database");
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-secret";
    delete process.env.API_KEY;
    client = await import("../db/client");
    app = (await import("../server")).app;
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[] = []) => pool.query(text, values);
    await q("INSERT INTO universities(id,name) VALUES($1,'Escola')", [ids.school]);
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'Informática',$2)", [ids.course, ids.school]);
    await q("INSERT INTO classes(id,name,course_id,registration_code) VALUES($1,'A',$3,$4),($2,'B',$3,$5)", [ids.classA, ids.classB, ids.course, `A-${ids.classA}`, `B-${ids.classB}`]);
    await q("INSERT INTO disciplines(id,name,course_id) VALUES($1,'Lógica',$3),($2,'Outra',$3)", [ids.logic, ids.other, ids.course]);
    await q("INSERT INTO class_disciplines(class_id,discipline_id) VALUES($1,$2),($3,$4)", [ids.classA, ids.logic, ids.classB, ids.other]);
    const hash = await bcrypt.hash(password, 4);
    for (const id of Object.values(people)) await q("INSERT INTO accounts(id,name,email,password_hash,status) VALUES($1,'Pessoa',$2,$3,'active')", [id, email(id), hash]);
    await q("INSERT INTO account_roles(account_id,role) VALUES($1,'professor'),($2,'professor'),($3,'professor'),($3,'course-coordinator'),($4,'student'),($5,'student')",
      [people.professor, people.stranger, people.coordinator, people.studentA, people.studentB]);
    await q("INSERT INTO professor_profiles(account_id,school_id) VALUES($1,$4),($2,$4),($3,$4)", [people.professor, people.stranger, people.coordinator, ids.school]);
    await q("INSERT INTO professor_disciplines(professor_id,discipline_id) VALUES($1,$2),($3,$2),($4,$5)", [people.professor, ids.logic, people.coordinator, people.stranger, ids.other]);
    await q("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$3,$4,$5),($2,$3,$4,$6)", [people.studentA, people.studentB, ids.school, ids.course, ids.classA, ids.classB]);
    await q(`INSERT INTO assessment_questions(id,owner_id,discipline_id,type,language,statement,content,concepts)
      VALUES($1,$2,$3,'quiz','pt-BR','O que é uma negação?',$4,'["negation"]')`, [ids.question, people.professor, ids.logic, JSON.stringify({ options: ["Inverte o valor lógico", "Soma"], correct: 0 })]);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [Object.values(people)]);
    await pool.query("DELETE FROM universities WHERE id = $1", [ids.school]);
    await pool.end();
    await client.closeDatabasePool();
  });

  const signIn = async (id: string) => {
    const agent = request.agent(app);
    await agent.post("/auth/session").send({ email: email(id), password }).expect(200);
    return agent;
  };

  it("lets the professor build a deck of their subject, with field-level validation", async () => {
    const professor = await signIn(people.professor);
    const invalid = (await professor.post("/flashcards/decks").send({ disciplineId: ids.logic, title: "", cards: [{ front: "p ∧ q", back: "" }] }).expect(400)).body;
    expect(invalid.issues).toEqual([{ field: "title", code: "REQUIRED" }, { field: "cards.0.back", code: "REQUIRED" }]);
    await professor.post("/flashcards/decks").send({ disciplineId: ids.other, title: "X", cards: [{ front: "a", back: "b" }] }).expect(403);

    const deck = (await professor.post("/flashcards/decks").send({
      disciplineId: ids.logic, title: "Conectivos", description: "Revisão rápida", language: "pt-BR",
      cards: [{ front: "p ∧ q", back: "Verdadeiro só se p e q forem verdadeiros", concept: "conjunction" }, { front: "¬p", back: "Inverte o valor de p", concept: "negation" }],
    }).expect(201)).body;
    deckId = deck.id;
    cardIds = deck.cards.map((card: { id: string }) => card.id);
    expect(deck).toMatchObject({ title: "Conectivos", published: false, cards: [{ front: "p ∧ q" }, { front: "¬p" }] });
    expect((await professor.get("/flashcards/decks").expect(200)).body).toEqual([expect.objectContaining({ id: deckId, cards: 2, disciplineName: "Lógica" })]);

    // Others: another professor cannot open it; the coordinator of the subject can.
    await (await signIn(people.stranger)).get(`/flashcards/decks/${deckId}`).expect(403);
    expect((await (await signIn(people.coordinator)).get("/flashcards/decks").expect(200)).body.map((row: { id: string }) => row.id)).toEqual([deckId]);
    // Bank quiz questions can become cards.
    expect((await professor.get("/flashcards/candidates").query({ disciplineId: ids.logic }).expect(200)).body)
      .toEqual([{ id: ids.question, front: "O que é uma negação?", back: "Inverte o valor lógico", concept: "negation" }]);
  });

  it("shows students only published decks of their class's subjects", async () => {
    const studentA = await signIn(people.studentA);
    expect((await studentA.get("/flashcards/study").expect(200)).body).toEqual([]);
    await studentA.get(`/flashcards/study/${deckId}`).expect(404);
    const professor = await signIn(people.professor);
    const deck = (await professor.get(`/flashcards/decks/${deckId}`).expect(200)).body;
    await professor.put(`/flashcards/decks/${deckId}`).send({ ...deck, published: true }).expect(200);

    expect((await studentA.get("/flashcards/study").expect(200)).body).toEqual([expect.objectContaining({ id: deckId, cards: 2, due: 2, seen: 0, known: 0, disciplineName: "Lógica" })]);
    const studentB = await signIn(people.studentB);
    expect((await studentB.get("/flashcards/study").expect(200)).body).toEqual([]);
    await studentB.get(`/flashcards/study/${deckId}`).expect(404);
    // Each side keeps to its own routes.
    await studentA.get("/flashcards/decks").expect(403);
    await professor.get("/flashcards/study").expect(403);
  });

  it("records each rating and brings hard cards back sooner", async () => {
    const studentA = await signIn(people.studentA);
    const session = (await studentA.get(`/flashcards/study/${deckId}`).expect(200)).body;
    expect(session).toMatchObject({ ahead: false, total: 2, due: 2 });
    expect(session.cards.map((card: { id: string }) => card.id)).toEqual(cardIds);
    await studentA.post(`/flashcards/cards/${cardIds[0]}/review`).send({ rating: "maybe" }).expect(400);
    expect((await studentA.post(`/flashcards/cards/${cardIds[0]}/review`).send({ rating: "good" }).expect(200)).body.box).toBe(2);
    expect((await studentA.post(`/flashcards/cards/${cardIds[1]}/review`).send({ rating: "again" }).expect(200)).body.box).toBe(1);
    expect((await studentA.get("/flashcards/study").expect(200)).body[0]).toMatchObject({ due: 0, seen: 2 });
    // Nothing due: practising ahead, the card coming back soonest (the one missed) first.
    const ahead = (await studentA.get(`/flashcards/study/${deckId}`).expect(200)).body;
    expect(ahead).toMatchObject({ ahead: true, due: 0 });
    expect(ahead.cards[0].id).toBe(cardIds[1]);
    await (await signIn(people.studentB)).post(`/flashcards/cards/${cardIds[0]}/review`).send({ rating: "good" }).expect(404);
  });

  it("keeps the progress of the cards that stay when the deck is edited, and hides archived decks", async () => {
    const professor = await signIn(people.professor);
    const deck = (await professor.get(`/flashcards/decks/${deckId}`).expect(200)).body;
    const saved = (await professor.put(`/flashcards/decks/${deckId}`).send({
      ...deck, cards: [deck.cards[0], { front: "p ∨ q", back: "Falso só se os dois forem falsos", sourceQuestionId: ids.question }],
    }).expect(200)).body;
    expect(saved.cards).toHaveLength(2);
    expect(saved.cards[0].id).toBe(cardIds[0]);
    const reviews = (await pool.query("SELECT card_id, box FROM flashcard_reviews WHERE student_id=$1", [people.studentA])).rows;
    expect(reviews).toEqual([{ card_id: cardIds[0], box: 2 }]);

    await professor.delete(`/flashcards/decks/${deckId}`).expect(204);
    expect((await professor.get("/flashcards/decks").expect(200)).body).toEqual([]);
    const studentA = await signIn(people.studentA);
    expect((await studentA.get("/flashcards/study").expect(200)).body).toEqual([]);
    await studentA.get(`/flashcards/study/${deckId}`).expect(404);
  });
});
