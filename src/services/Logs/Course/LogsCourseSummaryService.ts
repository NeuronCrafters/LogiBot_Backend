import { UserAnalysis } from "../../../models/UserAnalysis";
import { calculateUsageTime } from "../../../utils/TimeFormatter";

export async function LogsCourseSummaryService(courseId: string) {
  console.log("Buscando resumo para curso:", courseId);

  const users = await UserAnalysis.find({ courseId });

  console.log(`Encontrados ${users.length} registros de análise de usuários para curso`);

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

  return {
    totalCorrectAnswers,
    totalWrongAnswers,
    usageTimeInSeconds: totalUsageTime,
    usageTime: usageTimeObj,
    subjectCounts
  };
}