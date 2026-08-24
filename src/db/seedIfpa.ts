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
  universities,
} from "./schema";
import type { RagMode } from "../services/rag/ragTypes";

// Terceira rodada do experimento: IFPA, 2 cursos reais (I2261TI/I2261M1),
// 30 alunos cada. Mesmo padrao de seedRagExperimentRound2.ts — professor
// reaproveitado por referencia (sem upsert nessa linha, so os vinculos
// novos), namespace de id proprio (prefixo "b000") pra nao colidir com
// nada existente.

const IFPA_PASSWORD = "12345678";

const UNIVERSITY = {
  id: "00000000-0000-4000-b000-000000000001",
  name: "IFPA",
};

const PROFESSOR_ID = "00000000-0000-4000-9000-000000000004"; // professor.experimento@logibot.com

type CourseDef = {
  courseId: string;
  courseName: string;
  disciplineId: string;
  disciplineName: string;
  turmaLabel: string; // "Turma A" | "Turma B"
  groups: {
    classId: string;
    ragMode: RagMode;
    registrationCode: string;
    count: number;
  }[];
};

const COURSES: CourseDef[] = [
  {
    courseId: "00000000-0000-4000-b000-000000000002",
    courseName: "I2261TI",
    disciplineId: "00000000-0000-4000-b000-000000000004",
    disciplineName: "Workshop 1",
    turmaLabel: "Turma A",
    groups: [
      {
        classId: "00000000-0000-4000-b000-000000000011",
        ragMode: "none",
        registrationCode: "IFPATI-G1",
        count: 8,
      },
      {
        classId: "00000000-0000-4000-b000-000000000012",
        ragMode: "context",
        registrationCode: "IFPATI-G2",
        count: 8,
      },
      {
        classId: "00000000-0000-4000-b000-000000000013",
        ragMode: "self",
        registrationCode: "IFPATI-G3",
        count: 7,
      },
      {
        classId: "00000000-0000-4000-b000-000000000014",
        ragMode: "hybrid",
        registrationCode: "IFPATI-G4",
        count: 7,
      },
    ],
  },
  {
    courseId: "00000000-0000-4000-b000-000000000003",
    courseName: "I2261M1",
    disciplineId: "00000000-0000-4000-b000-000000000005",
    disciplineName: "Workshop 2",
    turmaLabel: "Turma B",
    groups: [
      {
        classId: "00000000-0000-4000-b000-000000000021",
        ragMode: "none",
        registrationCode: "IFPAM1-G1",
        count: 8,
      },
      {
        classId: "00000000-0000-4000-b000-000000000022",
        ragMode: "context",
        registrationCode: "IFPAM1-G2",
        count: 8,
      },
      {
        classId: "00000000-0000-4000-b000-000000000023",
        ragMode: "self",
        registrationCode: "IFPAM1-G3",
        count: 7,
      },
      {
        classId: "00000000-0000-4000-b000-000000000024",
        ragMode: "hybrid",
        registrationCode: "IFPAM1-G4",
        count: 7,
      },
    ],
  },
];

const RAG_SETTINGS_DEFAULTS = { topK: 4, minScore: 40 };

type IfpaStudent = {
  id: string;
  name: string;
  email: string;
  classId: string;
  courseId: string;
};

// Emails continuos ifpa01..ifpa60, sem revelar grupo. Ids sequenciais
// tambem continuos (101..160), independente do numero do email.
const STUDENTS: IfpaStudent[] = [];
{
  let emailSeq = 1;
  let idSeq = 101;
  for (const course of COURSES) {
    for (const group of course.groups) {
      for (let seat = 0; seat < group.count; seat++) {
        const emailNumber = String(emailSeq).padStart(2, "0");
        STUDENTS.push({
          id: `00000000-0000-4000-b000-000000000${idSeq}`,
          name: `Participante IFPA ${emailNumber}`,
          email: `ifpa${emailNumber}@logibot.com`,
          classId: group.classId,
          courseId: course.courseId,
        });
        emailSeq += 1;
        idSeq += 1;
      }
    }
  }
}

function className(turmaLabel: string, index: number) {
  return `${turmaLabel} - Grupo ${index + 1}`;
}

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

  for (const course of COURSES) {
    await db
      .insert(courses)
      .values({
        id: course.courseId,
        name: course.courseName,
        universityId: UNIVERSITY.id,
      })
      .onConflictDoUpdate({
        target: courses.id,
        set: {
          name: course.courseName,
          universityId: UNIVERSITY.id,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(disciplines)
      .values({
        id: course.disciplineId,
        name: course.disciplineName,
        courseId: course.courseId,
      })
      .onConflictDoUpdate({
        target: disciplines.id,
        set: {
          name: course.disciplineName,
          courseId: course.courseId,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(professorCourses)
      .values({ professorId: PROFESSOR_ID, courseId: course.courseId })
      .onConflictDoNothing();
    await db
      .insert(professorDisciplines)
      .values({ professorId: PROFESSOR_ID, disciplineId: course.disciplineId })
      .onConflictDoNothing();

    for (const [index, group] of course.groups.entries()) {
      const name = className(course.turmaLabel, index);

      await db
        .insert(classes)
        .values({
          id: group.classId,
          name,
          courseId: course.courseId,
          registrationCode: group.registrationCode,
        })
        .onConflictDoUpdate({
          target: classes.id,
          set: {
            name,
            courseId: course.courseId,
            registrationCode: group.registrationCode,
            updatedAt: new Date(),
          },
        });

      await db
        .insert(classDisciplines)
        .values({ classId: group.classId, disciplineId: course.disciplineId })
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

      await db
        .insert(professorClasses)
        .values({ professorId: PROFESSOR_ID, classId: group.classId })
        .onConflictDoNothing();
    }
  }

  for (const student of STUDENTS) {
    const account = await upsertAccount(db, {
      id: student.id,
      name: student.name,
      email: student.email,
      password: IFPA_PASSWORD,
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
        courseId: student.courseId,
        classId: student.classId,
        level: "iniciante",
      })
      .onConflictDoUpdate({
        target: studentProfiles.accountId,
        set: {
          schoolId: UNIVERSITY.id,
          courseId: student.courseId,
          classId: student.classId,
          level: "iniciante",
        },
      });
  }
}

function printCredentials() {
  console.log(
    "\n=== Credenciais IFPA — guarde em lugar seguro, NAO commitar ===\n",
  );
  console.log(`Link de acesso: https://saellogibot.com`);
  console.log(
    `Professor: (mesmo login das rodadas anteriores, ja tem acesso as novas turmas)\n`,
  );

  const classMeta = new Map<
    string,
    { turma: string; curso: string; ragMode: RagMode }
  >();
  for (const course of COURSES) {
    course.groups.forEach((group, index) => {
      classMeta.set(group.classId, {
        turma: className(course.turmaLabel, index),
        curso: course.courseName,
        ragMode: group.ragMode,
      });
    });
  }

  console.table(
    STUDENTS.map((student) => {
      const meta = classMeta.get(student.classId)!;
      return {
        email: student.email,
        senha: IFPA_PASSWORD,
        curso: meta.curso,
        turma_tecnica: meta.turma,
        modo_rag: meta.ragMode,
      };
    }),
  );
}

seed()
  .then(() => {
    printCredentials();
    logger.info("SeedIfpa", "IFPA seed completed.");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("SeedIfpa", "Failed to run IFPA seed.", error);
    process.exit(1);
  });
