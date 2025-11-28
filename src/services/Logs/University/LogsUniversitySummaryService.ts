import { UserAnalysis } from "../../../models/UserAnalysis";
import { calculateUsageTime } from "../../../utils/TimeFormatter";

export async function LogsUniversitySummaryService(universityId: string) {
  console.log("buscando resumo para universidade:", universityId);

  const users = await UserAnalysis.find({ schoolId: universityId });
  console.log(`encontrados ${users.length} registros de análise de usuários para universidade`);

  if (users.length === 0) {
    return {
      totalCorrectAnswers: 0,
      totalWrongAnswers: 0,
      usageTimeInSeconds: 0,
      usageTime: { totalSeconds: 0, formatted: "00:00:00", humanized: "0s", hours: 0, minutes: 0, seconds: 0 },
      subjectCounts: { variaveis: 0, tipos: 0, funcoes: 0, loops: 0, verificacoes: 0 },
      dailyUsage: [],
      sessions: []
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
  const allSessions: any[] = [];

  users.forEach((ua) => {
    totalCorrectAnswers += ua.totalCorrectWrongAnswers?.totalCorrectAnswers || 0;
    totalWrongAnswers += ua.totalCorrectWrongAnswers?.totalWrongAnswers || 0;
    totalUsageTime += ua.totalUsageTime || 0;

    // --- INÍCIO DA CORREÇÃO ---
    // Itera pelas sessões de CADA usuário para somar os dados do CHAT
    if (ua.sessions && ua.sessions.length > 0) {
      for (const session of ua.sessions) {
        if (session.subjectCountsChat) {
          subjectCounts.variaveis += session.subjectCountsChat.variaveis || 0;
          subjectCounts.tipos += session.subjectCountsChat.tipos || 0;
          subjectCounts.funcoes += session.subjectCountsChat.funcoes || 0;
          subjectCounts.loops += session.subjectCountsChat.loops || 0;
          subjectCounts.verificacoes += session.subjectCountsChat.verificacoes || 0;
        }
      }
    }
    // --- FIM DA CORREÇÃO ---

    // (O resto do seu código para coletar `allSessions` permanece o mesmo)
    if (ua.sessions && Array.isArray(ua.sessions)) {
      ua.sessions.forEach(session => {
        if (session.sessionStart && session.sessionEnd && session.sessionDuration) {
          allSessions.push({
            sessionStart: session.sessionStart,
            sessionEnd: session.sessionEnd,
            sessionDuration: session.sessionDuration,
            userId: ua.userId,
            userName: ua.name,
            courseName: ua.courseName || "",
            className: ua.className || ""
          });
        }
      });
    }
  });

  // (O resto do seu código para processar `dailyUsage` e `processedSessions` permanece o mesmo)
  const usageTimeObj = calculateUsageTime(totalUsageTime);

  const processedSessions = allSessions
    .sort((a, b) => b.sessionStart.getTime() - a.sessionStart.getTime())
    .map(session => {
      const durationInMinutes = session.sessionDuration / 60;
      const formattedDuration = calculateUsageTime(session.sessionDuration).formatted;
      const date = session.sessionStart.toISOString().split('T')[0];
      return {
        date,
        sessionStart: session.sessionStart,
        sessionEnd: session.sessionEnd,
        sessionDuration: session.sessionDuration,
        durationInMinutes,
        usage: durationInMinutes,
        formatted: formattedDuration,
        userId: session.userId,
        userName: session.userName,
        courseName: session.courseName,
        className: session.className
      };
    });

  const sessionsByDay: Record<string, any> = {};
  processedSessions.forEach(session => {
    if (!sessionsByDay[session.date]) {
      sessionsByDay[session.date] = { date: session.date, usage: 0, formatted: "00:00:00", sessions: [] };
    }
    sessionsByDay[session.date].usage += session.usage;
    sessionsByDay[session.date].sessions.push(session);
    const totalSecondsForDay = sessionsByDay[session.date].usage * 60;
    sessionsByDay[session.date].formatted = calculateUsageTime(totalSecondsForDay).formatted;
  });

  const dailyUsage = Object.values(sessionsByDay)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  return {
    totalCorrectAnswers,
    totalWrongAnswers,
    usageTimeInSeconds: totalUsageTime,
    usageTime: usageTimeObj,
    subjectCounts, // <-- USA O OBJETO CORRIGIDO E SOMADO
    dailyUsage,
    sessions: processedSessions
  };
}