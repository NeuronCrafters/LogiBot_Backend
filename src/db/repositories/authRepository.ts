import { and, desc, eq, inArray } from "drizzle-orm";
import type { AnyDbClient } from "../client";
import {
  accountRoles,
  accounts,
  analysisSessions,
  answerAttempts,
  answerQuestions,
  classes,
  classDisciplines,
  courses,
  disciplines,
  professorClasses,
  professorCourses,
  professorDisciplines,
  professorProfiles,
  studentProfiles,
  universities,
  userAnalyses,
} from "../schema";
import type { Role } from "../../types/Role";

export type AccountWithAuth = typeof accounts.$inferSelect & {
  roles: Role[];
  schoolId?: string | null;
  courseId?: string | null;
  classId?: string | null;
  level?: string | null;
  courses?: string[];
  classes?: string[];
  disciplines?: string[];
};

export async function getRoles(db: AnyDbClient, accountId: string): Promise<Role[]> {
  const rows = await db.select({ role: accountRoles.role })
    .from(accountRoles)
    .where(eq(accountRoles.accountId, accountId));
  return rows.map((row) => row.role as Role);
}

export async function getAccountByEmail(db: AnyDbClient, email: string): Promise<AccountWithAuth | null> {
  const [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
  if (!account) return null;
  return hydrateAccount(db, account);
}

export async function getAccountById(db: AnyDbClient, id: string): Promise<AccountWithAuth | null> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  if (!account) return null;
  return hydrateAccount(db, account);
}

async function hydrateAccount(db: AnyDbClient, account: typeof accounts.$inferSelect): Promise<AccountWithAuth> {
  const roles = await getRoles(db, account.id);
  const [studentProfile] = await db.select().from(studentProfiles).where(eq(studentProfiles.accountId, account.id)).limit(1);
  const [professorProfile] = await db.select().from(professorProfiles).where(eq(professorProfiles.accountId, account.id)).limit(1);
  const professorCourseRows = await db.select({ id: professorCourses.courseId }).from(professorCourses).where(eq(professorCourses.professorId, account.id));
  const professorClassRows = await db.select({ id: professorClasses.classId }).from(professorClasses).where(eq(professorClasses.professorId, account.id));
  const professorDisciplineRows = await db.select({ id: professorDisciplines.disciplineId }).from(professorDisciplines).where(eq(professorDisciplines.professorId, account.id));
  const studentDisciplineRows = studentProfile
    ? await db.select({ id: classDisciplines.disciplineId }).from(classDisciplines).where(eq(classDisciplines.classId, studentProfile.classId))
    : [];

  return {
    ...account,
    roles,
    schoolId: studentProfile?.schoolId || professorProfile?.schoolId || null,
    courseId: studentProfile?.courseId || null,
    classId: studentProfile?.classId || null,
    level: studentProfile?.level || null,
    courses: professorCourseRows.map((row) => row.id),
    classes: professorClassRows.map((row) => row.id),
    disciplines: [...studentDisciplineRows, ...professorDisciplineRows].map((row) => row.id),
  };
}

export async function findEntitiesByClassCode(db: AnyDbClient, code: string) {
  const [linkedClass] = await db.select()
    .from(classes)
    .where(eq(classes.registrationCode, code))
    .limit(1);
  if (!linkedClass) return null;

  const [course] = await db.select().from(courses).where(eq(courses.id, linkedClass.courseId)).limit(1);
  if (!course) return null;

  const [university] = await db.select().from(universities).where(eq(universities.id, course.universityId)).limit(1);
  if (!university) return null;

  const linkedDisciplineRows = await db.select({ disciplineId: classDisciplines.disciplineId })
    .from(classDisciplines)
    .where(eq(classDisciplines.classId, linkedClass.id));
  const disciplineIds = linkedDisciplineRows.map((row) => row.disciplineId);
  const linkedDisciplines = disciplineIds.length
    ? await db.select().from(disciplines).where(inArray(disciplines.id, disciplineIds))
    : [];

  return { university, course, class: linkedClass, disciplines: linkedDisciplines, registrationCode: linkedClass.registrationCode };
}

export async function createStudentAccount(db: AnyDbClient, input: {
  name: string;
  email: string;
  passwordHash: string;
  schoolId: string;
  courseId: string;
  classId: string;
}) {
  const [account] = await db.insert(accounts).values({
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    status: "active",
  }).returning();

  await db.insert(accountRoles).values({ accountId: account.id, role: "student" });
  await db.insert(studentProfiles).values({
    accountId: account.id,
    schoolId: input.schoolId,
    courseId: input.courseId,
    classId: input.classId,
    level: "desconhecido",
  });
  return getAccountById(db, account.id);
}

export async function startStudentSession(db: AnyDbClient, account: AccountWithAuth) {
  if (!account.schoolId || !account.courseId || !account.classId) return;

  const [[school], [course], [classDoc]] = await Promise.all([
    db.select().from(universities).where(eq(universities.id, account.schoolId)).limit(1),
    db.select().from(courses).where(eq(courses.id, account.courseId)).limit(1),
    db.select().from(classes).where(eq(classes.id, account.classId)).limit(1),
  ]);
  if (!school || !course || !classDoc) return;

  let [analysis] = await db.select().from(userAnalyses).where(eq(userAnalyses.userId, account.id)).limit(1);
  if (!analysis) {
    [analysis] = await db.insert(userAnalyses).values({
      userId: account.id,
      name: account.name,
      email: account.email,
      schoolId: school.id,
      schoolName: school.name,
      courseId: course.id,
      courseName: course.name,
      classId: classDoc.id,
      className: classDoc.name,
      subjectCountsQuiz: {},
    }).returning();
  }

  const [lastSession] = await db.select()
    .from(analysisSessions)
    .where(eq(analysisSessions.analysisId, analysis.id))
    .orderBy(desc(analysisSessions.sessionStart))
    .limit(1);

  if (lastSession && !lastSession.sessionEnd) {
    const end = new Date();
    const duration = Math.floor((end.getTime() - new Date(lastSession.sessionStart).getTime()) / 1000);
    await db.update(analysisSessions)
      .set({ sessionEnd: end, sessionDuration: duration, lastActivityAt: end })
      .where(eq(analysisSessions.id, lastSession.id));
  }

  await db.insert(analysisSessions).values({
    analysisId: analysis.id,
    subjectCountsChat: {},
  });
}

export async function getPublicMe(db: AnyDbClient, account: AccountWithAuth) {
  const [[school], [course], [classDoc], courseRows, classRows, disciplineRows] = await Promise.all([
    account.schoolId ? db.select().from(universities).where(eq(universities.id, account.schoolId)).limit(1) : Promise.resolve([]),
    account.courseId ? db.select().from(courses).where(eq(courses.id, account.courseId)).limit(1) : Promise.resolve([]),
    account.classId ? db.select().from(classes).where(eq(classes.id, account.classId)).limit(1) : Promise.resolve([]),
    account.courses?.length ? db.select().from(courses).where(inArray(courses.id, account.courses)) : Promise.resolve([]),
    account.classes?.length ? db.select().from(classes).where(inArray(classes.id, account.classes)) : Promise.resolve([]),
    account.disciplines?.length ? db.select().from(disciplines).where(inArray(disciplines.id, account.disciplines)) : Promise.resolve([]),
  ]);

  return {
    preferredLanguage: account.preferredLanguage,
    _id: account.id,
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.roles,
    schoolId: school?.id || "",
    schoolName: school?.name || "",
    courseId: course?.id,
    courseName: course?.name,
    classId: classDoc?.id,
    className: classDoc?.name,
    courses: courseRows.map((item) => ({ id: item.id, name: item.name })),
    classes: classRows.map((item) => ({ id: item.id, name: item.name })),
    disciplines: disciplineRows.map((item) => ({ id: item.id, name: item.name })),
  };
}

export async function listStudentDisciplineIds(db: AnyDbClient, studentId: string) {
  const [profile] = await db.select({ classId: studentProfiles.classId })
    .from(studentProfiles)
    .where(eq(studentProfiles.accountId, studentId))
    .limit(1);
  if (!profile) return [];

  const rows = await db.select({ id: classDisciplines.disciplineId })
    .from(classDisciplines)
    .where(eq(classDisciplines.classId, profile.classId));
  return rows.map((row) => row.id);
}

export async function saveStudentQuizResult(db: AnyDbClient, input: {
  userId: string;
  email: string;
  subject: string;
  level: string;
  totalCorrectAnswers: number;
  totalWrongAnswers: number;
  detalhes: Array<{
    question: string;
    selected: string;
    isCorrect: boolean;
    explanation?: string;
  }>;
}) {
  const [analysis] = await db.select()
    .from(userAnalyses)
    .where(and(eq(userAnalyses.userId, input.userId), eq(userAnalyses.email, input.email)))
    .limit(1);
  if (!analysis) return false;

  let [session] = await db.select()
    .from(analysisSessions)
    .where(eq(analysisSessions.analysisId, analysis.id))
    .orderBy(desc(analysisSessions.sessionStart))
    .limit(1);

  if (!session) {
    [session] = await db.insert(analysisSessions)
      .values({ analysisId: analysis.id, subjectCountsChat: {} })
      .returning();
  }

  await db.update(analysisSessions)
    .set({
      totalCorrectAnswers: session.totalCorrectAnswers + input.totalCorrectAnswers,
      totalWrongAnswers: session.totalWrongAnswers + input.totalWrongAnswers,
      lastActivityAt: new Date(),
    })
    .where(eq(analysisSessions.id, session.id));

  await db.update(userAnalyses)
    .set({
      totalCorrectAnswers: analysis.totalCorrectAnswers + input.totalCorrectAnswers,
      totalWrongAnswers: analysis.totalWrongAnswers + input.totalWrongAnswers,
    })
    .where(eq(userAnalyses.id, analysis.id));

  const [attempt] = await db.insert(answerAttempts)
    .values({
      sessionId: session.id,
      totalCorrectAnswers: input.totalCorrectAnswers,
      totalWrongAnswers: input.totalWrongAnswers,
    })
    .returning();

  if (input.detalhes.length) {
    await db.insert(answerQuestions).values(input.detalhes.map((detail) => ({
      attemptId: attempt.id,
      level: input.level,
      subject: input.subject,
      question: detail.question,
      selectedOption: detail.selected,
      isCorrect: detail.isCorrect,
      explanation: detail.explanation || null,
      totalCorrectAnswers: detail.isCorrect ? 1 : 0,
      totalWrongAnswers: detail.isCorrect ? 0 : 1,
    })));
  }

  return true;
}
