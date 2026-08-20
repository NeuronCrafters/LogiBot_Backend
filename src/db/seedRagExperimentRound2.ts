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
  studentProfiles,
} from "./schema";
import type { RagMode } from "../services/rag/ragTypes";

// Segunda rodada do experimento (Terceiro Ano Tecnico), mesma escola e
// professor do primeiro teste (seedRagExperiment.ts). So faz INSERT de
// linhas novas: NAO faz upsert em universities nem no account do professor,
// so referencia os ids ja existentes pra ligar curso/disciplina/turmas
// novas — garante que nada do primeiro teste e tocado.

const EXPERIMENT_PASSWORD = "12345678";

const UNIVERSITY_ID = "00000000-0000-4000-9000-000000000001"; // Gaspar Viana (primeiro teste)
const PROFESSOR_ID = "00000000-0000-4000-9000-000000000004"; // professor.experimento@logibot.com (primeiro teste)

const COURSE = {
  id: "00000000-0000-4000-9000-000000000005",
  name: "Terceiro Ano Técnico",
};

const DISCIPLINE = {
  id: "00000000-0000-4000-9000-000000000006",
  name: "Prog G2",
};

// Nomes de turma genericos de proposito: GET /auth/me devolve className pro
// aluno logado, entao o nome NAO pode revelar o modo de RAG (teste cego).
const GROUPS: {
  classId: string;
  className: string;
  registrationCode: string;
  ragMode: RagMode;
  count: number;
}[] = [
  {
    classId: "00000000-0000-4000-9000-000000000021",
    className: "Turma B - Grupo 1",
    registrationCode: "EXPB2026G1",
    ragMode: "none",
    count: 6,
  },
  {
    classId: "00000000-0000-4000-9000-000000000022",
    className: "Turma B - Grupo 2",
    registrationCode: "EXPB2026G2",
    ragMode: "context",
    count: 6,
  },
  {
    classId: "00000000-0000-4000-9000-000000000023",
    className: "Turma B - Grupo 3",
    registrationCode: "EXPB2026G3",
    ragMode: "self",
    count: 5,
  },
  {
    classId: "00000000-0000-4000-9000-000000000024",
    className: "Turma B - Grupo 4",
    registrationCode: "EXPB2026G4",
    ragMode: "hybrid",
    count: 5,
  },
];

const RAG_SETTINGS_DEFAULTS = { topK: 4, minScore: 40 };

type ExperimentStudent = {
  id: string;
  name: string;
  email: string;
  classId: string;
};

// Emails continuam a sequencia do primeiro teste (aluno01..aluno12), entao
// comecam em aluno13 — sem colidir, sem revelar o grupo do aluno.
const EMAIL_START = 13;
const ID_SUFFIX_START = 201;

const STUDENTS: ExperimentStudent[] = GROUPS.flatMap((group, groupIndex) => {
  const groupStartSeat = GROUPS.slice(0, groupIndex).reduce(
    (sum, g) => sum + g.count,
    0,
  );
  return Array.from({ length: group.count }, (_, seat) => {
    const seatIndex = groupStartSeat + seat;
    const emailNumber = String(EMAIL_START + seatIndex).padStart(2, "0");
    const idSuffix = ID_SUFFIX_START + seatIndex;
    return {
      id: `00000000-0000-4000-9000-000000000${idSuffix}`,
      name: `Participante ${emailNumber}`,
      email: `aluno${emailNumber}@logibot.com`,
      classId: group.classId,
    };
  });
});

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
    .insert(courses)
    .values({ ...COURSE, universityId: UNIVERSITY_ID })
    .onConflictDoUpdate({
      target: courses.id,
      set: {
        name: COURSE.name,
        universityId: UNIVERSITY_ID,
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

  // Professor e universidade sao os do primeiro teste, so referenciados por
  // id — nenhum upsert nessas duas linhas, so os vinculos novos abaixo.
  await db
    .insert(professorCourses)
    .values({ professorId: PROFESSOR_ID, courseId: COURSE.id })
    .onConflictDoNothing();
  await db
    .insert(professorDisciplines)
    .values({ professorId: PROFESSOR_ID, disciplineId: DISCIPLINE.id })
    .onConflictDoNothing();
  for (const group of GROUPS) {
    await db
      .insert(professorClasses)
      .values({ professorId: PROFESSOR_ID, classId: group.classId })
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
        schoolId: UNIVERSITY_ID,
        courseId: COURSE.id,
        classId: student.classId,
        level: "iniciante",
      })
      .onConflictDoUpdate({
        target: studentProfiles.accountId,
        set: {
          schoolId: UNIVERSITY_ID,
          courseId: COURSE.id,
          classId: student.classId,
          level: "iniciante",
        },
      });
  }
}

function printCredentials() {
  console.log(
    "\n=== Credenciais do segundo teste — guarde em lugar seguro, NAO commitar ===\n",
  );
  console.log(`Link de acesso: https://saellogibot.com`);
  console.log(
    `Professor: (mesmo login do primeiro teste, ja tem acesso as novas turmas)\n`,
  );
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
    logger.info("SeedRagExperimentRound2", "Round 2 experiment seed completed.");
    process.exit(0);
  })
  .catch((error) => {
    logger.error(
      "SeedRagExperimentRound2",
      "Failed to run round 2 experiment seed.",
      error,
    );
    process.exit(1);
  });
