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
  professorClasses,
  professorCourses,
  professorDisciplines,
  professorProfiles,
  studentProfiles,
  universities,
} from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { SANDBOX_STUDENT_COUNT, sandboxEmail } from "./sandboxConfig";
import { generateDemoData, isDemoPeriod, type DemoPeriod } from "./sandboxDemoData";
import { dropSandboxCollection } from "../rag/chromaService";
import { generatePlatformData } from "./sandboxPlatformData";

/** Structure of the test environment: two institutions of different kinds, two courses each, two classes per course. */
export const SANDBOX_STRUCTURE = [
  { institution: "Faculdade SAEL (teste)", courses: ["Ciência da Computação (teste)", "Sistemas de Informação (teste)"] },
  { institution: "Escola Técnica SAEL (teste)", courses: ["Técnico em Informática (teste)", "Técnico em Desenvolvimento de Sistemas (teste)"] },
];
const DISCIPLINES = ["Lógica de Programação", "Algoritmos e Estruturas de Dados"];
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
  const firstInstitution = { id: "", courses: [] as string[], classes: [] as string[], disciplines: [] as string[] };
  let code = 1;
  for (const [institutionIndex, item] of SANDBOX_STRUCTURE.entries()) {
    const [institution] = await db.insert(universities).values({ name: item.institution }).returning({ id: universities.id });
    if (institutionIndex === 0) firstInstitution.id = institution.id;
    for (const courseName of item.courses) {
      const [course] = await db.insert(courses).values({ name: courseName, universityId: institution.id }).returning({ id: courses.id });
      const disciplineIds: string[] = [];
      for (const name of DISCIPLINES) {
        const [discipline] = await db.insert(disciplines).values({ name, courseId: course.id }).returning({ id: disciplines.id });
        disciplineIds.push(discipline.id);
      }
      for (const className of CLASSES) {
        const [created] = await db.insert(classes).values({ name: className, courseId: course.id, registrationCode: `DEV-${String(code++).padStart(3, "0")}` }).returning({ id: classes.id });
        for (const disciplineId of disciplineIds) await db.insert(classDisciplines).values({ classId: created.id, disciplineId });
        allClasses.push({ id: created.id, courseId: course.id, schoolId: institution.id });
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
    await seedSandbox(db, password);
    // Activity of the chosen period (none for 0), so charts and filters can be checked with real-looking data.
    const activity = await generateDemoData(db, period);
    // Then the rest of the platform: chat with ratings, feedback, question bank, workbench, exams, notifications.
    const platform = await generatePlatformData(db, period);
    return { accounts: sandboxAccounts().length, institutions: SANDBOX_STRUCTURE.length, ...activity, ...platform };
  });
}
