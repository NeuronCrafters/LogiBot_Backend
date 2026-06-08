import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getExpressDb } from "./client";
import { logger } from "../logger";
import {
  accountRoles,
  accounts,
  classes,
  classDisciplines,
  classRagSettings,
  courses,
  disciplines,
  professorClasses,
  professorCourses,
  professorDisciplines,
  professorProfiles,
  studentProfiles,
  universities,
} from "./schema";

const ADMIN_USER_DATA = {
  name: "Admin",
  email: "admin@logibot.com",
  password: "admin@logibot.com",
  role: "admin",
  status: "active",
};

const STUDENT_ALUNO = {
  id: "00000000-0000-4000-8000-000000000205",
  name: "Aluno",
  email: "aluno@logibot.com",
  password: "aluno@logibot.com",
  role: "student",
  status: "active",
  level: "iniciante",
  classId: "00000000-0000-4000-8000-000000000108", // Turma NoRAG
};

const STUDENT_VITORIA = {
  id: "00000000-0000-4000-8000-000000000208",
  name: "Vitoria",
  email: "vitoria@logibot.com",
  password: "vitoria@logibot.com",
  role: "student",
  status: "active",
  level: "iniciante",
  classId: "00000000-0000-4000-8000-000000000109", // Turma SelfRAG
};

const STUDENT_MARCUS = {
  id: "00000000-0000-4000-8000-000000000209",
  name: "Marcus",
  email: "marcus@logibot.com",
  password: "marcus@logibot.com",
  role: "student",
  status: "active",
  level: "iniciante",
  classId: "00000000-0000-4000-8000-000000000103", // Turma ContextRAG
};

const PROFESSOR_USER_DATA = {
  id: "00000000-0000-4000-8000-000000000206",
  name: "Professor",
  email: "professor@logibot.com",
  password: "professor@logibot.com",
  roles: ["professor"],
  status: "active",
};

const COORDINATOR_USER_DATA = {
  id: "00000000-0000-4000-8000-000000000207",
  name: "Coordenador",
  email: "coordenador@logibot.com",
  password: "coordenador@logibot.com",
  roles: ["professor", "course-coordinator"],
  status: "active",
};

const ACADEMIC_SEED_DATA = {
  university: {
    id: "00000000-0000-4000-8000-000000000101",
    name: "Universidade LogiBot",
  },
  course: {
    id: "00000000-0000-4000-8000-000000000102",
    name: "Sistemas de Informação",
  },
  discipline: {
    id: "00000000-0000-4000-8000-000000000104",
    name: "Programação 1",
  },
  classes: [
    {
      id: "00000000-0000-4000-8000-000000000103",
      name: "Turma ContextRAG",
      registrationCode: "LOGI2026",
      ragMode: "context" as const,
    },
    {
      id: "00000000-0000-4000-8000-000000000108",
      name: "Turma NoRAG",
      registrationCode: "NORG2026",
      ragMode: "none" as const,
    },
    {
      id: "00000000-0000-4000-8000-000000000109",
      name: "Turma SelfRAG",
      registrationCode: "SELF2026",
      ragMode: "self" as const,
    },
  ],
};

const RAG_SETTINGS_DEFAULTS = {
  topK: 4,
  minScore: 50,
};

type SeedUserData = {
  id?: string;
  name: string;
  email: string;
  password: string;
  status: string;
};

type SeedProfessorData = SeedUserData & {
  id: string;
  roles: string[];
};

async function upsertAccount(
  db: ReturnType<typeof getExpressDb>,
  user: SeedUserData,
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
        .values(user.id ? { id: user.id, ...values } : values)
        .returning();

  return account;
}

async function seedProfessorLikeUser(
  db: ReturnType<typeof getExpressDb>,
  user: SeedProfessorData,
) {
  const account = await upsertAccount(db, user);

  await db
    .insert(accountRoles)
    .values(user.roles.map((role) => ({ accountId: account.id, role })))
    .onConflictDoNothing();

  await db
    .insert(professorProfiles)
    .values({
      accountId: account.id,
      schoolId: ACADEMIC_SEED_DATA.university.id,
    })
    .onConflictDoNothing();

  await db
    .insert(professorCourses)
    .values({
      professorId: account.id,
      courseId: ACADEMIC_SEED_DATA.course.id,
    })
    .onConflictDoNothing();

  for (const cls of ACADEMIC_SEED_DATA.classes) {
    await db
      .insert(professorClasses)
      .values({ professorId: account.id, classId: cls.id })
      .onConflictDoNothing();
  }

  await db
    .insert(professorDisciplines)
    .values({
      professorId: account.id,
      disciplineId: ACADEMIC_SEED_DATA.discipline.id,
    })
    .onConflictDoNothing();

  return account;
}

async function seedStudent(
  db: ReturnType<typeof getExpressDb>,
  user: typeof STUDENT_ALUNO,
) {
  const account = await upsertAccount(db, user);

  await db
    .insert(accountRoles)
    .values({ accountId: account.id, role: user.role })
    .onConflictDoNothing();

  await db
    .insert(studentProfiles)
    .values({
      accountId: account.id,
      schoolId: ACADEMIC_SEED_DATA.university.id,
      courseId: ACADEMIC_SEED_DATA.course.id,
      classId: user.classId,
      level: user.level,
    })
    .onConflictDoUpdate({
      target: studentProfiles.accountId,
      set: {
        schoolId: ACADEMIC_SEED_DATA.university.id,
        courseId: ACADEMIC_SEED_DATA.course.id,
        classId: user.classId,
        level: user.level,
      },
    });

  return account;
}

async function seed() {
  const db = getExpressDb();

  const admin = await upsertAccount(db, ADMIN_USER_DATA);

  await db
    .insert(accountRoles)
    .values({ accountId: admin.id, role: ADMIN_USER_DATA.role })
    .onConflictDoNothing();

  await db
    .insert(universities)
    .values(ACADEMIC_SEED_DATA.university)
    .onConflictDoUpdate({
      target: universities.id,
      set: { name: ACADEMIC_SEED_DATA.university.name, updatedAt: new Date() },
    });

  await db
    .insert(courses)
    .values({
      ...ACADEMIC_SEED_DATA.course,
      universityId: ACADEMIC_SEED_DATA.university.id,
    })
    .onConflictDoUpdate({
      target: courses.id,
      set: {
        name: ACADEMIC_SEED_DATA.course.name,
        universityId: ACADEMIC_SEED_DATA.university.id,
        updatedAt: new Date(),
      },
    });

  for (const cls of ACADEMIC_SEED_DATA.classes) {
    await db
      .insert(classes)
      .values({ ...cls, courseId: ACADEMIC_SEED_DATA.course.id })
      .onConflictDoUpdate({
        target: classes.id,
        set: {
          name: cls.name,
          courseId: ACADEMIC_SEED_DATA.course.id,
          registrationCode: cls.registrationCode,
          updatedAt: new Date(),
        },
      });
  }

  await db
    .insert(disciplines)
    .values({
      ...ACADEMIC_SEED_DATA.discipline,
      courseId: ACADEMIC_SEED_DATA.course.id,
    })
    .onConflictDoUpdate({
      target: disciplines.id,
      set: {
        name: ACADEMIC_SEED_DATA.discipline.name,
        courseId: ACADEMIC_SEED_DATA.course.id,
        updatedAt: new Date(),
      },
    });

  for (const cls of ACADEMIC_SEED_DATA.classes) {
    await db
      .insert(classDisciplines)
      .values({
        classId: cls.id,
        disciplineId: ACADEMIC_SEED_DATA.discipline.id,
      })
      .onConflictDoNothing();
  }

  for (const cls of ACADEMIC_SEED_DATA.classes) {
    await db
      .insert(classRagSettings)
      .values({
        classId: cls.id,
        ragMode: cls.ragMode,
        topK: RAG_SETTINGS_DEFAULTS.topK,
        minScore: RAG_SETTINGS_DEFAULTS.minScore,
      })
      .onConflictDoUpdate({
        target: classRagSettings.classId,
        set: {
          ragMode: cls.ragMode,
          topK: RAG_SETTINGS_DEFAULTS.topK,
          minScore: RAG_SETTINGS_DEFAULTS.minScore,
          updatedAt: new Date(),
        },
      });
  }

  await seedProfessorLikeUser(db, PROFESSOR_USER_DATA);
  await seedProfessorLikeUser(db, COORDINATOR_USER_DATA);

  await seedStudent(db, STUDENT_ALUNO);
  await seedStudent(db, STUDENT_VITORIA);
  await seedStudent(db, STUDENT_MARCUS);
}

seed()
  .then(() => {
    logger.info("Seed", "Database seed completed.");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Seed", "Failed to run database seed.", error);
    process.exit(1);
  });
