import { UserAnalysis } from "../../../models/UserAnalysis";
import { calculateUsageTime } from "../../../utils/TimeFormatter";
import { Class } from "../../../models/Class";

export async function LogsClassComparisonService(
  classId1: string,
  classId2: string
) {
  console.log("Comparando turmas:", classId1, classId2);

  // Buscar informações das turmas para verificar se são do mesmo curso
  const class1 = await Class.findById(classId1);
  const class2 = await Class.findById(classId2);

  if (!class1 || !class2) {
    throw new Error("Uma ou ambas as turmas não foram encontradas.");
  }

  // Corrigido: usando course em vez de courseId
  if (!class1.course.equals(class2.course)) {
    throw new Error("As turmas não pertencem ao mesmo curso.");
  }

  // Busca dados das duas turmas
  const class1Data = await fetchClassData(classId1);
  const class2Data = await fetchClassData(classId2);

  return {
    class1: class1Data,
    class2: class2Data
  };
}

async function fetchClassData(classId: string) {
  const users = await UserAnalysis.find({ classId });

  console.log(`Encontrados ${users.length} registros para turma ${classId}`);

  // Se não há usuários, retorna zeros
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
    subjectCounts,
    userCount: users.length
  };
}