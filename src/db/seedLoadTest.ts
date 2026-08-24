import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getExpressDb } from "./client";
import { logger } from "../logger";
import {
  accountRoles,
  accounts,
  classDisciplines,
  classRagSettings,
  classes,
  courses,
  disciplines,
  professorClasses,
  professorCourses,
  professorDisciplines,
  professorProfiles,
  studentProfiles,
  universities,
} from "./schema";
import type { RagMode } from "../services/rag/ragTypes";

// Dados totalmente isolados pra rodar o teste de carga k6 (load-tests/chat-stress.js,
// perfil class40) sem tocar nas turmas reais de alunos (Turma A/B). Namespace de
// id proprio (prefixo "a000"), separado dos outros seeds ("8000" dev, "9000"
// experimento real). O script k6 loga uma vez por modo em setup() e reusa o
// token pra todas as VUs daquele modo — so precisa de 1 conta por modo, nao 40.

const LOAD_TEST_PASSWORD = "12345678";

const UNIVERSITY = {
  id: "00000000-0000-4000-a000-000000000001",
  name: "Escola de Testes de Carga",
};

const COURSE = {
  id: "00000000-0000-4000-a000-000000000002",
  name: "Curso de Testes",
};

const DISCIPLINE = {
  id: "00000000-0000-4000-a000-000000000003",
  name: "Teste de Carga",
};

const PROFESSOR = {
  id: "00000000-0000-4000-a000-000000000004",
  name: "Professor Teste de Carga",
  email: "professor.teste-carga@logibot.com",
  password: LOAD_TEST_PASSWORD,
  status: "active",
};

const GROUPS: {
  classId: string;
  className: string;
  registrationCode: string;
  ragMode: RagMode;
  studentId: string;
  studentEmail: string;
}[] = [
  {
    classId: "00000000-0000-4000-a000-000000000011",
    className: "Turma Teste de Carga - None",
    registrationCode: "K6LOAD-NONE",
    ragMode: "none",
    studentId: "00000000-0000-4000-a000-000000000101",
    studentEmail: "k6-none@logibot.com",
  },
  {
    classId: "00000000-0000-4000-a000-000000000012",
    className: "Turma Teste de Carga - Context",
    registrationCode: "K6LOAD-CTX",
    ragMode: "context",
    studentId: "00000000-0000-4000-a000-000000000102",
    studentEmail: "k6-context@logibot.com",
  },
  {
    classId: "00000000-0000-4000-a000-000000000013",
    className: "Turma Teste de Carga - Self",
    registrationCode: "K6LOAD-SELF",
    ragMode: "self",
    studentId: "00000000-0000-4000-a000-000000000103",
    studentEmail: "k6-self@logibot.com",
  },
];

const RAG_SETTINGS_DEFAULTS = { topK: 4, minScore: 40 };

async function upsertAccount(
  db: ReturnType<typeof getExpressDb>,
  user: {
    id: string;
    name: string;
    email: string;
    password: string;
    status: string;
  },
) {
  const passwordHash = await bcrypt.hash(user.password, 10);
  const existing = await db.query.accounts.findFirst({
    where: eq(accounts.email, user.email),
  });

  const values = {
    name: user.name,
    email: user.email,
    passwordHash,
    status: user.status,
  };

  const [account] = existing
    ? await db
        .update(accounts)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(accounts.id, existing.id))
        .returning()
    : await db
        .insert(accounts)
        .values({ id: user.id, ...values })
        .returning();

  return account;
}

async function seed() {
  const db = getExpressDb();

  await db
    .insert(universities)
    .values(UNIVERSITY)
    .onConflictDoUpdate({
      target: universities.id,
      set: { name: UNIVERSITY.name, updatedAt: new Date() },
    });

  await db
    .insert(courses)
    .values({ ...COURSE, universityId: UNIVERSITY.id })
    .onConflictDoUpdate({
      target: courses.id,
      set: {
        name: COURSE.name,
        universityId: UNIVERSITY.id,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(disciplines)
    .values({ ...DISCIPLINE, courseId: COURSE.id })
    .onConflictDoUpdate({
      target: disciplines.id,
      set: {
        name: DISCIPLINE.name,
        courseId: COURSE.id,
        updatedAt: new Date(),
      },
    });

  for (const group of GROUPS) {
    await db
      .insert(classes)
      .values({
        id: group.classId,
        name: group.className,
        courseId: COURSE.id,
        registrationCode: group.registrationCode,
      })
      .onConflictDoUpdate({
        target: classes.id,
        set: {
          name: group.className,
          courseId: COURSE.id,
          registrationCode: group.registrationCode,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(classDisciplines)
      .values({ classId: group.classId, disciplineId: DISCIPLINE.id })
      .onConflictDoNothing();

    await db
      .insert(classRagSettings)
      .values({
        classId: group.classId,
        ragMode: group.ragMode,
        topK: RAG_SETTINGS_DEFAULTS.topK,
        minScore: RAG_SETTINGS_DEFAULTS.minScore,
      })
      .onConflictDoUpdate({
        target: classRagSettings.classId,
        set: {
          ragMode: group.ragMode,
          topK: RAG_SETTINGS_DEFAULTS.topK,
          minScore: RAG_SETTINGS_DEFAULTS.minScore,
          updatedAt: new Date(),
        },
      });
  }

  const professorAccount = await upsertAccount(db, PROFESSOR);
  await db
    .insert(accountRoles)
    .values({ accountId: professorAccount.id, role: "professor" })
    .onConflictDoNothing();
  await db
    .insert(professorProfiles)
    .values({ accountId: professorAccount.id, schoolId: UNIVERSITY.id })
    .onConflictDoNothing();
  await db
    .insert(professorCourses)
    .values({ professorId: professorAccount.id, courseId: COURSE.id })
    .onConflictDoNothing();
  await db
    .insert(professorDisciplines)
    .values({ professorId: professorAccount.id, disciplineId: DISCIPLINE.id })
    .onConflictDoNothing();
  for (const group of GROUPS) {
    await db
      .insert(professorClasses)
      .values({ professorId: professorAccount.id, classId: group.classId })
      .onConflictDoNothing();
  }

  for (const group of GROUPS) {
    const account = await upsertAccount(db, {
      id: group.studentId,
      name: `K6 Load Test (${group.ragMode})`,
      email: group.studentEmail,
      password: LOAD_TEST_PASSWORD,
      status: "active",
    });

    await db
      .insert(accountRoles)
      .values({ accountId: account.id, role: "student" })
      .onConflictDoNothing();

    await db
      .insert(studentProfiles)
      .values({
        accountId: account.id,
        schoolId: UNIVERSITY.id,
        courseId: COURSE.id,
        classId: group.classId,
        level: "iniciante",
      })
      .onConflictDoUpdate({
        target: studentProfiles.accountId,
        set: {
          schoolId: UNIVERSITY.id,
          courseId: COURSE.id,
          classId: group.classId,
          level: "iniciante",
        },
      });
  }
}

function printCredentials() {
  console.log(
    "\n=== Credenciais do teste de carga (K6_PROFILE=class40) ===\n",
  );
  console.log(`Professor: ${PROFESSOR.email} / senha: ${LOAD_TEST_PASSWORD}`);
  console.log(
    `(use o login do professor pra subir material RAG nas turmas Context/Self antes de rodar o teste)\n`,
  );
  console.table(
    GROUPS.map((group) => ({
      modo: group.ragMode,
      turma: group.className,
      classId: group.classId,
      email: group.studentEmail,
      senha: LOAD_TEST_PASSWORD,
    })),
  );
  console.log("\nVariaveis pro k6:");
  for (const group of GROUPS) {
    console.log(
      `K6_${group.ragMode.toUpperCase()}_EMAIL=${group.studentEmail}  K6_${group.ragMode.toUpperCase()}_PASSWORD=${LOAD_TEST_PASSWORD}`,
    );
  }
}

seed()
  .then(() => {
    printCredentials();
    logger.info("SeedLoadTest", "Load test seed completed.");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("SeedLoadTest", "Failed to run load test seed.", error);
    process.exit(1);
  });
