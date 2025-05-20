import { UserAnalysis } from "../../../models/UserAnalysis";
import { calculateUsageTime } from "../../../utils/TimeFormatter";

export async function LogsClassSummaryService(classId: string) {
  console.log("Buscando resumo para turma:", classId);

  const users = await UserAnalysis.find({ classId });

  console.log(`Encontrados ${users.length} registros de análise de usuários para turma`);

  // Se não há usuários, retorna zeros
  if (users.length === 0) {
    return {
      totalCorrectAnswers: 0,
      totalWrongAnswers: 0,
      usageTimeInSeconds: 0,
      usageTime: {
        formatted: "00:00:00",
        humanized: "0s",
        hours: 0,
        minutes: 0,
        seconds: 0
      },
      mostAccessedSubjects: {},
      userCount: 0,
      subjectCounts: {}
    };
  }

  let totalCorrectAnswers = 0;
  let totalWrongAnswers = 0;
  let totalUsageTime = 0;
  const subjectFrequency: Record<string, number> = {};
  const subjectCounts: Record<string, number> = {};

  users.forEach((ua) => {
    // Soma total de acertos/erros
    totalCorrectAnswers += ua.totalCorrectWrongAnswers?.totalCorrectAnswers || 0;
    totalWrongAnswers += ua.totalCorrectWrongAnswers?.totalWrongAnswers || 0;
    totalUsageTime += ua.totalUsageTime || 0;

    // Processa subjectCounts (dados acumulados de todos os assuntos)
    if (ua.subjectCounts && typeof ua.subjectCounts === 'object') {
      for (const subject in ua.subjectCounts) {
        const count = ua.subjectCounts[subject];
        subjectCounts[subject] = (subjectCounts[subject] || 0) +
          (typeof count === 'number' ? count : 0);
      }
    }

    // Processa sessions para dados por sessão
    if (ua.sessions && Array.isArray(ua.sessions)) {
      ua.sessions.forEach((session) => {
        if (session.subjectFrequency && typeof session.subjectFrequency === 'object') {
          for (const subject in session.subjectFrequency) {
            const count = session.subjectFrequency[subject];
            subjectFrequency[subject] = (subjectFrequency[subject] || 0) +
              (typeof count === 'number' ? count : 0);
          }
        }
      });
    }
  });

  // Formatar mostAccessedSubjects como um objeto para facilitar o uso no frontend
  const formattedSubjects: Record<string, number> = {};
  Object.entries(subjectFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([subject, count]) => {
      formattedSubjects[subject] = count;
    });

  // Formatar tempo de uso
  const usageTimeObj = calculateUsageTime(totalUsageTime);

  return {
    totalCorrectAnswers,
    totalWrongAnswers,
    usageTimeInSeconds: totalUsageTime,  // Mantém o valor original em segundos
    usageTime: usageTimeObj,  // Adiciona objeto com formatos humanizados
    mostAccessedSubjects: formattedSubjects,
    userCount: users.length,
    subjectCounts
  };
}