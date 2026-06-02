import { eq } from "drizzle-orm";
import { getExpressDb } from "./client";
import {
  accountRoles,
  accounts,
  classes,
  classDisciplines,
  courses,
  disciplines,
  studentDisciplines,
  studentProfiles,
  universities,
} from "./schema";

const ADMIN_USER_DATA = {
  name: "admin",
  email: "ch47b07sa3l@gmail.com",
  passwordHash: "$2a$10$EmiRe/ZX5XLSN1JJp/GJ.O87MELljrlQBtabyJUyp7z/lwLKshBfW",
  role: "admin",
  status: "active",
};

const STUDENT_USER_DATA = {
  id: "00000000-0000-4000-8000-000000000201",
  name: "Aluno Teste",
  email: "aluno.teste@saellogibot.com",
  passwordHash: "$2a$10$JgNi9vz/MFYgumVR8z2ci.0kn6ea2hOV4DE0PBHao/q2hMKFBkvQK",
  role: "student",
  status: "active",
  level: "iniciante",
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
  class: {
    id: "00000000-0000-4000-8000-000000000103",
    name: "Turma 2026",
  },
  discipline: {
    id: "00000000-0000-4000-8000-000000000104",
    name: "Fundamentos de Programação",
    code: "LOGI2026",
  },
};

async function seed() {
  const db = getExpressDb();
  const existing = await db.query.accounts.findFirst({
    where: eq(accounts.email, ADMIN_USER_DATA.email),
  });

  const [account] = existing
    ? await db
        .update(accounts)
        .set({
          name: ADMIN_USER_DATA.name,
          passwordHash: ADMIN_USER_DATA.passwordHash,
          status: ADMIN_USER_DATA.status,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, existing.id))
        .returning()
    : await db
        .insert(accounts)
        .values({
          name: ADMIN_USER_DATA.name,
          email: ADMIN_USER_DATA.email,
          passwordHash: ADMIN_USER_DATA.passwordHash,
          status: ADMIN_USER_DATA.status,
        })
        .returning();

  await db
    .insert(accountRoles)
    .values({ accountId: account.id, role: ADMIN_USER_DATA.role })
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
    })
    .onConflictDoNothing();

  const [student] = await db
    .insert(accounts)
    .values({
      id: STUDENT_USER_DATA.id,
      name: STUDENT_USER_DATA.name,
      email: STUDENT_USER_DATA.email,
      passwordHash: STUDENT_USER_DATA.passwordHash,
      status: STUDENT_USER_DATA.status,
    })
    .onConflictDoUpdate({
      target: accounts.email,
      set: {
        name: STUDENT_USER_DATA.name,
        passwordHash: STUDENT_USER_DATA.passwordHash,
        status: STUDENT_USER_DATA.status,
        updatedAt: new Date(),
      },
    })
    .returning();

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
    console.log("seed concluido");
    process.exit(0);
  })
  .catch((error) => {
    console.error("erro ao executar seed", error);
    process.exit(1);
  });
