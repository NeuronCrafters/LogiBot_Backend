import { UserAnalysis } from "../../../models/UserAnalysis";
import { calculateUsageTime } from "../../../utils/TimeFormatter";

export async function LogsClassSummaryService(classId: string) {
  console.log("Buscando resumo para turma:", classId);

  const users = await UserAnalysis.find({ classId });

  console.log(`Encontrados ${users.length} registros de análise de usuários para turma`);

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

    if (ua.subjectCounts && typeof ua.subjectCounts === 'object') {
      if (typeof ua.subjectCounts.variaveis === 'number') subjectCounts.variaveis += ua.subjectCounts.variaveis;
      if (typeof ua.subjectCounts.tipos === 'number') subjectCounts.tipos += ua.subjectCounts.tipos;
      if (typeof ua.subjectCounts.funcoes === 'number') subjectCounts.funcoes += ua.subjectCounts.funcoes;
      if (typeof ua.subjectCounts.loops === 'number') subjectCounts.loops += ua.subjectCounts.loops;
      if (typeof ua.subjectCounts.verificacoes === 'number') subjectCounts.verificacoes += ua.subjectCounts.verificacoes;
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