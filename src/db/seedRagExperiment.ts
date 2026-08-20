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

// Namespace de IDs proprio (prefixo "9000"), separado do seed.ts de dev
// (prefixo "8000"), para nao colidir e manter os dados reais do experimento
// isolados das fixtures internas de desenvolvimento. Este script e
// autocontido (nao depende de rodar db:seed antes).

const EXPERIMENT_PASSWORD = "12345678";

const UNIVERSITY = {
  id: "00000000-0000-4000-9000-000000000001",
  name: "Gaspar Viana",
};

const COURSE = {
  id: "00000000-0000-4000-9000-000000000002",
  name: "Segundo Ano Técnico",
};

const DISCIPLINE = {
  id: "00000000-0000-4000-9000-000000000003",
  name: "Prog G1",
};

const PROFESSOR = {
  id: "00000000-0000-4000-9000-000000000004",
  name: "Professor Experimento",
  email: "professor.experimento@logibot.com",
  password: EXPERIMENT_PASSWORD,
  status: "active",
};

// Nomes de turma genericos de proposito: GET /auth/me devolve className pro
// aluno logado, entao o nome NAO pode revelar o modo de RAG (teste cego).
const GROUPS: {
  classId: string;
  className: string;
  registrationCode: string;
  ragMode: RagMode;
}[] = [
  {
    classId: "00000000-0000-4000-9000-000000000011",
    className: "Turma A - Grupo 1",
    registrationCode: "EXPA2026G1",
    ragMode: "none",
  },
  {
    classId: "00000000-0000-4000-9000-000000000012",
    className: "Turma A - Grupo 2",
    registrationCode: "EXPA2026G2",
    ragMode: "context",
  },
  {
    classId: "00000000-0000-4000-9000-000000000013",
    className: "Turma A - Grupo 3",
    registrationCode: "EXPA2026G3",
    ragMode: "self",
  },
  {
    classId: "00000000-0000-4000-9000-000000000014",
    className: "Turma A - Grupo 4",
    registrationCode: "EXPA2026G4",
    ragMode: "hybrid",
  },
];

const RAG_SETTINGS_DEFAULTS = { topK: 4, minScore: 40 };

type ExperimentStudent = {
  id: string;
  name: string;
  email: string;
  classId: string;
};

// Emails sequenciais que nao revelam o grupo do aluno (aluno01..aluno12), 3
// por turma, na mesma ordem de GROUPS acima.
const STUDENTS: ExperimentStudent[] = GROUPS.flatMap((group, groupIndex) =>
  [0, 1, 2].map((seat) => {
    const number = groupIndex * 3 + seat + 1;
    const padded = String(number).padStart(2, "0");
    return {
      id: `00000000-0000-4000-9000-0000000001${padded}`,
      name: `Participante ${padded}`,
      email: `aluno${padded}@logibot.com`,
      classId: group.classId,
    };
  }),
);

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

  for (const student of STUDENTS) {
    const account = await upsertAccount(db, {
      id: student.id,
      name: student.name,
      email: student.email,
      password: EXPERIMENT_PASSWORD,
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
        classId: student.classId,
        level: "iniciante",
      })
      .onConflictDoUpdate({
        target: studentProfiles.accountId,
        set: {
          schoolId: UNIVERSITY.id,
          courseId: COURSE.id,
          classId: student.classId,
          level: "iniciante",
        },
      });
  }
}

function printCredentials() {
  console.log(
    "\n=== Credenciais do experimento — guarde em lugar seguro, NAO commitar ===\n",
  );
  console.log(`Link de acesso: https://saellogibot.com`);
  console.log(`Professor: ${PROFESSOR.email} / senha: ${EXPERIMENT_PASSWORD}\n`);
  console.log(
    "Alunos — turma tecnica e modo de RAG sao so para SEU controle, NAO mostrar ao aluno:\n",
  );
  console.table(
    STUDENTS.map((student) => {
      const group = GROUPS.find((g) => g.classId === student.classId)!;
      return {
        email: student.email,
        senha: EXPERIMENT_PASSWORD,
        turma_tecnica: group.className,
        modo_rag: group.ragMode,
      };
    }),
  );
}

seed()
  .then(() => {
    printCredentials();
    logger.info("SeedRagExperiment", "Experiment seed completed.");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("SeedRagExperiment", "Failed to run experiment seed.", error);
    process.exit(1);
  });
