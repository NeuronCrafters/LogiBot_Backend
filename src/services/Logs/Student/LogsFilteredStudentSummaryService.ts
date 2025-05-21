import { UserAnalysis } from "../../../models/UserAnalysis";
import { calculateUsageTime } from "../../../utils/TimeFormatter";

export async function LogsFilteredStudentSummaryService(
  universityId: string,
  courseId?: string,
  classId?: string,
  studentId?: string
) {
  const query: any = { schoolId: universityId };

  if (courseId) query.courseId = courseId;
  if (classId) query.classId = classId;
  if (studentId) query.userId = studentId;

  console.log("Query para UserAnalysis:", query);

  const users = await UserAnalysis.find(query);

  console.log(`Encontrados ${users.length} registros de análise de usuários`);

  if (users.length === 0) {
    return {
      totalCorrectAnswers: 0,
      totalWrongAnswers: 0,
      usageTimeInSeconds: 0,
      usageTime: {
        totalSeconds: 0,
        formatted: "00:00:00",
        humanized: "0s",
        hours: 0,
        minutes: 0,
        seconds: 0
      },
      subjectCounts: {
        variaveis: 0,
        tipos: 0,
        funcoes: 0,
        loops: 0,
        verificacoes: 0
      }
    };
  }

  let totalCorrectAnswers = 0;
  let totalWrongAnswers = 0;
  let totalUsageTime = 0;
  const subjectCounts: Record<string, number> = {
    variaveis: 0,
    tipos: 0,
    funcoes: 0,
    loops: 0,
    verificacoes: 0
  };

  users.forEach((ua) => {
    totalCorrectAnswers += ua.totalCorrectWrongAnswers?.totalCorrectAnswers || 0;
    totalWrongAnswers += ua.totalCorrectWrongAnswers?.totalWrongAnswers || 0;
    totalUsageTime += ua.totalUsageTime || 0;

    if (ua.subjectCountsQuiz && typeof ua.subjectCountsQuiz === 'object') {
      if (typeof ua.subjectCountsQuiz.variaveis === 'number') subjectCounts.variaveis += ua.subjectCountsQuiz.variaveis;
      if (typeof ua.subjectCountsQuiz.tipos === 'number') subjectCounts.tipos += ua.subjectCountsQuiz.tipos;
      if (typeof ua.subjectCountsQuiz.funcoes === 'number') subjectCounts.funcoes += ua.subjectCountsQuiz.funcoes;
      if (typeof ua.subjectCountsQuiz.loops === 'number') subjectCounts.loops += ua.subjectCountsQuiz.loops;
      if (typeof ua.subjectCountsQuiz.verificacoes === 'number') subjectCounts.verificacoes += ua.subjectCountsQuiz.verificacoes;
    }
  });

  const usageTimeObj = calculateUsageTime(totalUsageTime);

  let result: any = {
    totalCorrectAnswers,
    totalWrongAnswers,
    usageTimeInSeconds: totalUsageTime,
    usageTime: usageTimeObj,
    subjectCounts
  };

  if (studentId && users.length > 0) {
    const userUsageTime = calculateUsageTime(users[0].totalUsageTime || 0);

    const userSubjectCounts = {
      variaveis: users[0].subjectCountsQuiz?.variaveis || 0,
      tipos: users[0].subjectCountsQuiz?.tipos || 0,
      funcoes: users[0].subjectCountsQuiz?.funcoes || 0,
      loops: users[0].subjectCountsQuiz?.loops || 0,
      verificacoes: users[0].subjectCountsQuiz?.verificacoes || 0
    };

    result.users = {
      _id: users[0]._id,
      userId: users[0].userId,
      name: users[0].name,
      email: users[0].email,
      schoolId: users[0].schoolId,
      schoolName: users[0].schoolName,
      courseId: users[0].courseId,
      courseName: users[0].courseName,
      classId: users[0].classId,
      className: users[0].className,
      totalUsageTime: users[0].totalUsageTime,
      usageTime: userUsageTime,
      totalCorrectWrongAnswers: users[0].totalCorrectWrongAnswers,
      subjectCounts: userSubjectCounts
    };
  }

  return result;
}