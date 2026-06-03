import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getExpressDb } from "./client";
import { logger } from "../logger";
import {
  accountRoles,
  accounts,
  classes,
  classDisciplines,
  courses,
  disciplines,
  professorClasses,
  professorCourses,
  professorDisciplines,
  professorProfiles,
  studentDisciplines,
  studentProfiles,
  universities,
} from "./schema";
import { generateUniqueRegistrationCode } from "../services/academic/disciplineCode";

const ADMIN_USER_DATA = {
  name: "admin",
  email: "admin@logibot.com",
  password: "admin@logibot.com",
  role: "admin",
  status: "active",
};

const STUDENT_USER_DATA = {
  id: "00000000-0000-4000-8000-000000000205",
  name: "Aluno Teste",
  email: "aluno@logibot.com",
  password: "aluno@logibot.com",
  role: "student",
  status: "active",
  level: "iniciante",
};

const PROFESSOR_USER_DATA = {
  id: "00000000-0000-4000-8000-000000000206",
  name: "Professor Teste",
  email: "professor@logibot.com",
  password: "professor@logibot.com",
  roles: ["professor"],
  status: "active",
};

const COORDINATOR_USER_DATA = {
  id: "00000000-0000-4000-8000-000000000207",
  name: "Coordenador Teste",
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
    name: "Sistemas de Informacao",
  },
  class: {
    id: "00000000-0000-4000-8000-000000000103",
    name: "Turma 2026",
  },
  discipline: {
    id: "00000000-0000-4000-8000-000000000104",
    name: "Fundamentos de Programacao",
    code: "LOGI2026",
  },
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

async function upsertAccount(db: ReturnType<typeof getExpressDb>, user: SeedUserData) {
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

async function seedProfessorLikeUser(db: ReturnType<typeof getExpressDb>, user: SeedProfessorData) {
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

  await db
    .insert(professorClasses)
    .values({
      professorId: account.id,
      classId: ACADEMIC_SEED_DATA.class.id,
    })
    .onConflictDoNothing();

  await db
    .insert(professorDisciplines)
    .values({
      professorId: account.id,
      disciplineId: ACADEMIC_SEED_DATA.discipline.id,
    })
    .onConflictDoNothing();

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

  await db
    .insert(classes)
    .values({
      ...ACADEMIC_SEED_DATA.class,
      courseId: ACADEMIC_SEED_DATA.course.id,
    })
    .onConflictDoUpdate({
      target: classes.id,
      set: {
        name: ACADEMIC_SEED_DATA.class.name,
        courseId: ACADEMIC_SEED_DATA.course.id,
        updatedAt: new Date(),
      },
    });

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
        code: ACADEMIC_SEED_DATA.discipline.code,
        courseId: ACADEMIC_SEED_DATA.course.id,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(classDisciplines)
    .values({
      classId: ACADEMIC_SEED_DATA.class.id,
      disciplineId: ACADEMIC_SEED_DATA.discipline.id,
      code: ACADEMIC_SEED_DATA.discipline.code,
    })
    .onConflictDoUpdate({
      target: [classDisciplines.classId, classDisciplines.disciplineId],
      set: { code: ACADEMIC_SEED_DATA.discipline.code || await generateUniqueRegistrationCode(db) },
    });

  await seedProfessorLikeUser(db, PROFESSOR_USER_DATA);
  await seedProfessorLikeUser(db, COORDINATOR_USER_DATA);

  const student = await upsertAccount(db, STUDENT_USER_DATA);

  await db
    .insert(accountRoles)
    .values({ accountId: student.id, role: STUDENT_USER_DATA.role })
    .onConflictDoNothing();

  await db
    .insert(studentProfiles)
    .values({
      accountId: student.id,
      schoolId: ACADEMIC_SEED_DATA.university.id,
      courseId: ACADEMIC_SEED_DATA.course.id,
      classId: ACADEMIC_SEED_DATA.class.id,
      level: STUDENT_USER_DATA.level,
    })
    .onConflictDoUpdate({
      target: studentProfiles.accountId,
      set: {
        schoolId: ACADEMIC_SEED_DATA.university.id,
        courseId: ACADEMIC_SEED_DATA.course.id,
        classId: ACADEMIC_SEED_DATA.class.id,
        level: STUDENT_USER_DATA.level,
      },
    });

  await db
    .insert(studentDisciplines)
    .values({
      studentId: student.id,
      disciplineId: ACADEMIC_SEED_DATA.discipline.id,
    })
    .onConflictDoNothing();
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
