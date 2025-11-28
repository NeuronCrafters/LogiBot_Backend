// ARQUIVO COMPLETO E CORRIGIDO: /src/services/Logs/Student/LogsFilteredStudentSummaryService.ts

import { UserAnalysis } from "../../../models/UserAnalysis";
import { calculateUsageTime } from "../../../utils/TimeFormatter";

// Função de retorno padrão para evitar repetição e garantir consistência
function getEmptySummary() {
  return {
    totalCorrectAnswers: 0,
    totalWrongAnswers: 0,
    usageTimeInSeconds: 0,
    usageTime: { totalSeconds: 0, formatted: "00:00:00", humanized: "0s", hours: 0, minutes: 0, seconds: 0 },
    subjectCounts: { variaveis: 0, tipos: 0, funcoes: 0, loops: 0, verificacoes: 0 },
    sessions: [],
    dailyUsage: [],
    users: null
  };
}

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

  // Se especificou um studentId, busca e processa apenas aquele aluno
  if (studentId) {
    const user = await UserAnalysis.findOne(query).lean();

    if (!user) {

      return getEmptySummary();
    }

    const totalSubjectCounts = { variaveis: 0, tipos: 0, funcoes: 0, loops: 0, verificacoes: 0 };
    (user.sessions || []).forEach(session => {
      if (session.subjectCountsChat) {
        totalSubjectCounts.variaveis += session.subjectCountsChat.variaveis || 0;
        totalSubjectCounts.tipos += session.subjectCountsChat.tipos || 0;
        totalSubjectCounts.funcoes += session.subjectCountsChat.funcoes || 0;
        totalSubjectCounts.loops += session.subjectCountsChat.loops || 0;
        totalSubjectCounts.verificacoes += session.subjectCountsChat.verificacoes || 0;
      }
    });

    // Processa as sessões do aluno para calcular o uso diário para o gráfico
    const processedSessions = (user.sessions || [])
      .filter(session => session.sessionStart && session.sessionEnd && session.sessionDuration)
      .sort((a, b) => new Date(b.sessionStart).getTime() - new Date(a.sessionStart).getTime())
      .map(session => ({
        date: new Date(session.sessionStart).toISOString().split("T")[0],
        sessionStart: session.sessionStart,
        sessionEnd: session.sessionEnd,
        sessionDuration: session.sessionDuration,
        usage: (session.sessionDuration || 0) / 60, // 'usage' em minutos, que o gráfico usa
        formatted: calculateUsageTime(session.sessionDuration || 0).formatted,
        userId: user.userId,
        userName: user.name,
      }));

    // Agrupa as sessões processadas por dia
    const sessionsByDay: Record<string, any> = {};
    processedSessions.forEach(session => {
      if (!sessionsByDay[session.date]) {
        sessionsByDay[session.date] = {
          date: session.date,
          usage: 0,
          formatted: "00:00:00",
          sessions: [],
        };
      }
      sessionsByDay[session.date].usage += session.usage; // Soma os minutos de uso no dia
      sessionsByDay[session.date].sessions.push(session);
    });

    // Formata o tempo total de cada dia
    Object.values(sessionsByDay).forEach(day => {
      const totalSecondsForDay = Math.round(day.usage * 60);
      day.formatted = calculateUsageTime(totalSecondsForDay).formatted;
    });

    // Cria o array `dailyUsage` que o gráfico precisa para funcionar
    const dailyUsage = Object.values(sessionsByDay).sort((a, b) => b.date.localeCompare(a.date));

    const usageTimeObj = calculateUsageTime(user.totalUsageTime || 0);

    return {
      totalCorrectAnswers: user.totalCorrectWrongAnswers?.totalCorrectAnswers || 0,
      totalWrongAnswers: user.totalCorrectWrongAnswers?.totalWrongAnswers || 0,
      usageTimeInSeconds: user.totalUsageTime || 0,
      usageTime: usageTimeObj,
      subjectCounts: totalSubjectCounts,
      dailyUsage, // Agora esta variável contém os dados corretos
      sessions: processedSessions,
      users: user
    };
  }

  // Se não especificou studentId, busca e agrega todos os alunos que atendem aos critérios
  const users = await UserAnalysis.find(query).lean();


  if (users.length === 0) {
    return getEmptySummary();
  }

  let totalCorrectAnswers = 0;
  let totalWrongAnswers = 0;
  let totalUsageTime = 0;
  const subjectCounts: Record<string, number> = { variaveis: 0, tipos: 0, funcoes: 0, loops: 0, verificacoes: 0 };
  const allSessions: any[] = [];

  users.forEach((ua) => {
    totalCorrectAnswers += ua.totalCorrectWrongAnswers?.totalCorrectAnswers || 0;
    totalWrongAnswers += ua.totalCorrectWrongAnswers?.totalWrongAnswers || 0;
    totalUsageTime += ua.totalUsageTime || 0;

    if (ua.sessions && Array.isArray(ua.sessions)) {
      ua.sessions.forEach(session => {
        if (session.subjectCountsChat) {
          subjectCounts.variaveis += session.subjectCountsChat.variaveis || 0;
          subjectCounts.tipos += session.subjectCountsChat.tipos || 0;
          subjectCounts.funcoes += session.subjectCountsChat.funcoes || 0;
          subjectCounts.loops += session.subjectCountsChat.loops || 0;
          subjectCounts.verificacoes += session.subjectCountsChat.verificacoes || 0;
        }
        if (session.sessionStart && session.sessionEnd && session.sessionDuration) {
          allSessions.push({
            sessionStart: session.sessionStart,
            sessionEnd: session.sessionEnd,
            sessionDuration: session.sessionDuration,
            userId: ua.userId,
            userName: ua.name,
          });
        }
      });
    }
  });

  const usageTimeObj = calculateUsageTime(totalUsageTime);

  const processedSessions = allSessions
    .sort((a, b) => new Date(b.sessionStart).getTime() - new Date(a.sessionStart).getTime())
    .map(session => ({
      date: new Date(session.sessionStart).toISOString().split("T")[0],
      sessionStart: session.sessionStart,
      sessionEnd: session.sessionEnd,
      sessionDuration: session.sessionDuration,
      usage: (session.sessionDuration || 0) / 60,
      formatted: calculateUsageTime(session.sessionDuration || 0).formatted,
      userId: session.userId,
      userName: session.userName,
    }));

  const sessionsByDay: Record<string, any> = {};
  processedSessions.forEach(session => {
    if (!sessionsByDay[session.date]) {
      sessionsByDay[session.date] = {
        date: session.date,
        usage: 0,
        formatted: "00:00:00",
        sessions: []
      };
    }
    sessionsByDay[session.date].usage += session.usage;
    sessionsByDay[session.date].sessions.push(session);
  });

  Object.values(sessionsByDay).forEach(day => {
    const totalSecondsForDay = Math.round(day.usage * 60);
    day.formatted = calculateUsageTime(totalSecondsForDay).formatted;
  });

  const dailyUsage = Object.values(sessionsByDay).sort((a, b) => b.date.localeCompare(a.date));

  return {
    totalCorrectAnswers,
    totalWrongAnswers,
    usageTimeInSeconds: totalUsageTime,
    usageTime: usageTimeObj,
    subjectCounts,
    dailyUsage,
    sessions: processedSessions,
    users: null
  };
}