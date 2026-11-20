import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { getDb, type AnyDbClient } from "../../db/client";
import { getSandboxDatabaseUrl, runInEnvironment } from "../../db/environment";
import {
  accountRoles,
  accounts,
  classDisciplines,
  classes,
  courses,
  disciplines,
  institutionProfiles,
  professorClasses,
  professorCourses,
  professorDisciplines,
  professorProfiles,
  flashcardDecks,
  flashcards,
  studentProfiles,
  universities,
} from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { SANDBOX_STUDENT_COUNT, sandboxEmail } from "./sandboxConfig";
import { generateDemoData, isDemoPeriod, type DemoPeriod } from "./sandboxDemoData";
import { dropSandboxCollection } from "../rag/chromaService";
import { generatePlatformData } from "./sandboxPlatformData";
import { clearSandboxImages } from "../institutions/institutionImageStore";

/** Structure of the test environment: two institutions of different kinds, two courses each, two classes per course. */
export const SANDBOX_STRUCTURE = [
  { institution: "Faculdade SAEL (teste)", courses: ["Ciência da Computação (teste)", "Sistemas de Informação (teste)"],
    profile: { kind: "faculdade", city: "Belém", state: "PA", country: "Brasil", about: "Instituição fictícia do ambiente de teste, com cursos de computação e turmas de lógica e algoritmos.",
      address: "Avenida do Ensino", addressNumber: "1000", district: "Centro", postalCode: "66000-000", latitude: -1.4558, longitude: -48.4902,
      website: "https://www.example.com/faculdade-sael", links: [{ kind: "site", url: "https://www.example.com/faculdade-sael/eventos" }, { kind: "blog", url: "https://blog.example.com/faculdade-sael" }] } },
  { institution: "Escola Técnica SAEL (teste)", courses: ["Técnico em Informática (teste)", "Técnico em Desenvolvimento de Sistemas (teste)"],
    profile: { kind: "escola_tecnica", city: "Ananindeua", state: "PA", country: "Brasil", about: "Escola técnica fictícia do ambiente de teste, com cursos técnicos integrados ao ensino médio na área de informática.",
      address: "Rua da Tecnologia", addressNumber: "250", district: "Centro", postalCode: "67000-000", latitude: -1.3656, longitude: -48.3722,
      website: "https://www.example.com/escola-tecnica-sael", links: [{ kind: "site", url: "https://www.example.com/escola-tecnica-sael/cursos" }] } },
];
const DISCIPLINES = ["Lógica de Programação", "Algoritmos e Estruturas de Dados"];
/** Example decks, one per subject above (same order): front, back and concept of each card. */
const SANDBOX_DECKS: Array<{ title: string; description: string; cards: Array<[string, string, string | null]> }> = [
  { title: "Conectivos lógicos", description: "Revisão rápida dos conectivos e das tabelas-verdade.", cards: [
    ["Quando p ∧ q é verdadeiro?", "Só quando p e q são verdadeiros.", "conjunction"],
    ["Quando p ∨ q é falso?", "Só quando p e q são falsos.", "disjunction"],
    ["O que faz ¬p?", "Inverte o valor lógico de p.", "negation"],
    ["Quando p → q é falso?", "Só quando p é verdadeiro e q é falso.", "conditional"],
    ["Quando p ↔ q é verdadeiro?", "Quando p e q têm o mesmo valor lógico.", "biconditional"],
    ["Quantas linhas tem a tabela-verdade de 3 proposições?", "8 linhas (2³).", null],
    ["Como se nega p ∧ q (De Morgan)?", "¬p ∨ ¬q.", "negation"],
    ["O que é uma contradição?", "Uma fórmula falsa em todas as linhas.", null],
  ] },
  { title: "Algoritmos: estruturas básicas", description: "Sequência, decisão e repetição em poucas palavras.", cards: [
    ["Para que serve uma estrutura de decisão (se/senão)?", "Executar um bloco ou outro conforme uma condição.", "selection"],
    ["Qual a diferença entre enquanto e para?", "Enquanto repete por uma condição; para repete um número conhecido de vezes.", "repetition"],
    ["O que é uma variável?", "Um espaço com nome que guarda um valor que pode mudar.", null],
    ["O que é um vetor?", "Uma coleção de valores do mesmo tipo acessados por posição.", null],
    ["O que acontece num laço sem condição de parada?", "Ele nunca termina (laço infinito).", "repetition"],
    ["O que uma função devolve?", "O valor do seu retorno, para quem a chamou.", null],
  ] },
];
const CLASSES = ["Turma A", "Turma B"];

export function sandboxPassword(): string {
  const password = process.env.SANDBOX_PASSWORD || "";
  if (password.length < 12) throw new AppError("sandbox.passwordMissing", 503);
  return password;
}

/** E-mails of every test account, in the order shown in the Dev area. */
export function sandboxAccounts() {
  return [
    { email: sandboxEmail("adm"), role: "admin" },
    { email: sandboxEmail("coordenador"), role: "course-coordinator" },
    { email: sandboxEmail("professor"), role: "professor" },
    { email: sandboxEmail("coordenador2"), role: "course-coordinator" },
    { email: sandboxEmail("professor2"), role: "professor" },
    ...Array.from({ length: SANDBOX_STUDENT_COUNT }, (_item, index) => ({ email: sandboxEmail(`aluno${index}`), role: "student" })),
  ];
}

async function createAccount(db: AnyDbClient, email: string, name: string, passwordHash: string, roles: string[]) {
  const [account] = await db.insert(accounts).values({ name, email, passwordHash, status: "active", preferredLanguage: "pt-BR" }).returning({ id: accounts.id });
  for (const role of roles) await db.insert(accountRoles).values({ accountId: account.id, role });
  return account.id;
}

/** Creates the test structure and accounts in an empty test database. Returns false if it was already there. */
export async function seedSandbox(db: AnyDbClient, password: string): Promise<boolean> {
  const [existing] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, sandboxEmail("adm"))).limit(1);
  if (existing) return false;
  const passwordHash = await bcrypt.hash(password, 10);

  const allClasses: Array<{ id: string; courseId: string; schoolId: string }> = [];
  // Each institution with its courses, classes and subjects (courses in order, subjects per course).
  const institutionsMade: Array<{ id: string; courses: Array<{ id: string; classes: string[]; disciplines: string[] }> }> = [];
  const firstInstitution = { id: "", courses: [] as string[], classes: [] as string[], disciplines: [] as string[] };
  let code = 1;
  for (const [institutionIndex, item] of SANDBOX_STRUCTURE.entries()) {
    const [institution] = await db.insert(universities).values({ name: item.institution }).returning({ id: universities.id });
    // Page of the institution: type, location and a short description (no images).
    await db.insert(institutionProfiles).values({ universityId: institution.id, ...item.profile });
    if (institutionIndex === 0) firstInstitution.id = institution.id;
    institutionsMade.push({ id: institution.id, courses: [] });
    for (const courseName of item.courses) {
      const [course] = await db.insert(courses).values({ name: courseName, universityId: institution.id }).returning({ id: courses.id });
      const disciplineIds: string[] = [];
      const made = { id: course.id, classes: [] as string[], disciplines: disciplineIds };
      institutionsMade[institutionIndex].courses.push(made);
      for (const name of DISCIPLINES) {
        const [discipline] = await db.insert(disciplines).values({ name, courseId: course.id }).returning({ id: disciplines.id });
        disciplineIds.push(discipline.id);
      }
      for (const className of CLASSES) {
        const [created] = await db.insert(classes).values({ name: className, courseId: course.id, registrationCode: `DEV-${String(code++).padStart(3, "0")}` }).returning({ id: classes.id });
        for (const disciplineId of disciplineIds) await db.insert(classDisciplines).values({ classId: created.id, disciplineId });
        allClasses.push({ id: created.id, courseId: course.id, schoolId: institution.id });
        made.classes.push(created.id);
        if (institutionIndex === 0) firstInstitution.classes.push(created.id);
      }
      if (institutionIndex === 0) {
        firstInstitution.courses.push(course.id);
        firstInstitution.disciplines.push(...disciplineIds);
      }
    }
  }

  await createAccount(db, sandboxEmail("adm"), "Administrador (teste)", passwordHash, ["admin"]);

  // Professor of the first institution (all its courses, classes and subjects).
  const professorId = await createAccount(db, sandboxEmail("professor"), "Professor (teste)", passwordHash, ["professor"]);
  await db.insert(professorProfiles).values({ accountId: professorId, schoolId: firstInstitution.id });
  for (const courseId of firstInstitution.courses) await db.insert(professorCourses).values({ professorId, courseId });
  for (const classId of firstInstitution.classes) await db.insert(professorClasses).values({ professorId, classId });
  for (const disciplineId of firstInstitution.disciplines) await db.insert(professorDisciplines).values({ professorId, disciplineId });

  // Coordinator of the first course.
  const coordinatorId = await createAccount(db, sandboxEmail("coordenador"), "Coordenação (teste)", passwordHash, ["professor", "course-coordinator"]);
  await db.insert(professorProfiles).values({ accountId: coordinatorId, schoolId: firstInstitution.id });
  await db.insert(professorCourses).values({ professorId: coordinatorId, courseId: firstInstitution.courses[0] });
  for (const disciplineId of firstInstitution.disciplines.slice(0, DISCIPLINES.length)) await db.insert(professorDisciplines).values({ professorId: coordinatorId, disciplineId });

  // Second institution: its own coordination (first course) and a professor who teaches every class
  // and subject there, so each institution page shows who is in charge of each subject.
  const second = institutionsMade[1];
  if (second) {
    const coordinator2 = await createAccount(db, sandboxEmail("coordenador2"), "Coordenação Escola (teste)", passwordHash, ["professor", "course-coordinator"]);
    await db.insert(professorProfiles).values({ accountId: coordinator2, schoolId: second.id });
    await db.insert(professorCourses).values({ professorId: coordinator2, courseId: second.courses[0].id });
    for (const disciplineId of second.courses[0].disciplines) await db.insert(professorDisciplines).values({ professorId: coordinator2, disciplineId });
    const professor2 = await createAccount(db, sandboxEmail("professor2"), "Professor Escola (teste)", passwordHash, ["professor"]);
    await db.insert(professorProfiles).values({ accountId: professor2, schoolId: second.id });
    for (const course of second.courses) {
      await db.insert(professorCourses).values({ professorId: professor2, courseId: course.id });
      for (const classId of course.classes) await db.insert(professorClasses).values({ professorId: professor2, classId });
      for (const disciplineId of course.disciplines) await db.insert(professorDisciplines).values({ professorId: professor2, disciplineId });
    }
  }

  // Flash cards: one published deck per subject, made by the professor of each institution, and a draft.
  const owners = [professorId, second ? (await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, sandboxEmail("professor2"))).limit(1))[0]?.id : undefined];
  for (const [institutionIndex, made] of institutionsMade.entries()) {
    const ownerId = owners[institutionIndex];
    if (!ownerId) continue;
    for (const course of made.courses) {
      for (const [subjectIndex, disciplineId] of course.disciplines.entries()) {
        const deck = SANDBOX_DECKS[subjectIndex % SANDBOX_DECKS.length];
        const [created] = await db.insert(flashcardDecks).values({ ownerId, disciplineId, title: deck.title, description: deck.description, language: "pt-BR", published: true }).returning({ id: flashcardDecks.id });
        await db.insert(flashcards).values(deck.cards.map(([front, back, concept], position) => ({ deckId: created.id, front, back, concept, position })));
      }
    }
  }
  const [draftCourse] = institutionsMade[0]?.courses ?? [];
  if (draftCourse) {
    const [draft] = await db.insert(flashcardDecks).values({ ownerId: professorId, disciplineId: draftCourse.disciplines[0], title: "Revisão para a prova (rascunho)", description: "Ainda não publicado: só a equipe vê.", language: "pt-BR", published: false }).returning({ id: flashcardDecks.id });
    await db.insert(flashcards).values([{ deckId: draft.id, front: "O que é uma tautologia?", back: "Uma fórmula verdadeira em todas as linhas da tabela-verdade.", concept: "tautology", position: 0 }]);
  }

  // Students spread over every class of both institutions.
  for (let index = 0; index < SANDBOX_STUDENT_COUNT; index++) {
    const target = allClasses[index % allClasses.length];
    const studentId = await createAccount(db, sandboxEmail(`aluno${index}`), `Aluno ${index} (teste)`, passwordHash, ["student"]);
    await db.insert(studentProfiles).values({ accountId: studentId, schoolId: target.schoolId, courseId: target.courseId, classId: target.id });
  }
  return true;
}

/**
 * Erases and recreates the whole test database. Only ever runs against SANDBOX_DATABASE_URL,
 * which must be a different database from the main one.
 */
export async function resetSandbox(days: unknown = 0) {
  if (!getSandboxDatabaseUrl()) throw new AppError("sandbox.notConfigured", 503);
  if (!isDemoPeriod(days)) throw new AppError("sandbox.periodInvalid", 400);
  const period: DemoPeriod = days;
  const password = sandboxPassword();
  return runInEnvironment("sandbox", async () => {
    const db = getDb();
    const tables = await db.execute(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    const names = (tables.rows as Array<{ tablename: string }>).map((row) => `"public"."${row.tablename.replace(/"/g, "")}"`);
    if (names.length) await db.execute(sql.raw(`TRUNCATE ${names.join(", ")} RESTART IDENTITY CASCADE`));
    // The RAG documents were just erased, so their vectors go too (only the test collection).
    await dropSandboxCollection();
    // And the institution images of the test environment.
    await clearSandboxImages();
    await seedSandbox(db, password);
    // Activity of the chosen period (none for 0), so charts and filters can be checked with real-looking data.
    const activity = await generateDemoData(db, period);
    // Then the rest of the platform: chat with ratings, feedback, question bank, workbench, exams, notifications.
    const platform = await generatePlatformData(db, period);
    return { accounts: sandboxAccounts().length, institutions: SANDBOX_STRUCTURE.length, ...activity, ...platform };
  });
}
