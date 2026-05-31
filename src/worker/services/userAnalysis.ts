import { ObjectId } from "mongodb";
import type { collections } from "../db/collections";
import type { ClassDocument, CourseDocument, StudentDocument, UniversityDocument } from "../types";

const emptySubjectCounts = {
  variaveis: 0,
  listas: 0,
  condicionais: 0,
  operadores_logicos: 0,
  funcoes: 0,
  repeticao: 0,
  verificacoes: 0,
};

export async function startStudentSession(
  col: ReturnType<typeof collections>,
  user: StudentDocument,
  university?: UniversityDocument | null,
  course?: CourseDocument | null,
  classDoc?: ClassDocument | null,
) {
  if (!user.course || !user.class || !user.school) return;

  const existing = await col.userAnalyses.findOne({ userId: String(user._id) });
  const session = {
    sessionStart: new Date(),
    lastActivityAt: new Date(),
    totalCorrectAnswers: 0,
    totalWrongAnswers: 0,
    subjectCountsChat: emptySubjectCounts,
    answerHistory: [],
  };

  if (!existing) {
    const schoolDoc = university || await col.universities.findOne({ _id: new ObjectId(String(user.school)) });
    const courseDoc = course || await col.courses.findOne({ _id: new ObjectId(String(user.course)) });
    const classDocument = classDoc || await col.classes.findOne({ _id: new ObjectId(String(user.class)) });

    if (!schoolDoc?._id || !courseDoc?._id || !classDocument?._id) return;

    await col.userAnalyses.insertOne({
      userId: String(user._id),
      name: user.name,
      email: user.email,
      schoolId: schoolDoc._id,
      schoolName: schoolDoc.name,
      courseId: courseDoc._id,
      courseName: courseDoc.name,
      classId: classDocument._id,
      className: classDocument.name,
      totalUsageTime: 0,
      sessions: [session],
    });
    return;
  }

  const sessions = existing.sessions || [];
  const lastSession = sessions.at(-1);
  if (lastSession && !lastSession.sessionEnd) {
    const start = new Date(String(lastSession.sessionStart || new Date()));
    const end = new Date(String(lastSession.lastActivityAt || start));
    lastSession.sessionEnd = end;
    lastSession.sessionDuration = (end.getTime() - start.getTime()) / 1000;
  }

  sessions.push(session);
  await col.userAnalyses.updateOne({ _id: existing._id }, { $set: { sessions } });
}
