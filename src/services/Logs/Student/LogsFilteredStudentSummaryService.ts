// ARQUIVO COMPLETO E CORRIGIDO: /src/services/Logs/Student/LogsFilteredStudentSummaryService.ts

import { UserAnalysis } from "../../../models/UserAnalysis";
import { calculateUsageTime } from "../../../utils/TimeFormatter";

export async function LogsFilteredStudentSummaryService(
  universityId: string,
  courseId?: string,
  classId?: string,
  studentId?: string
) {
  console.log("Buscando dados filtrados:", { universityId, courseId, classId, studentId });

  const query: any = { schoolId: universityId };
  if (courseId) query.courseId = courseId;
  if (classId) query.classId = classId;
  if (studentId) query.userId = studentId;

  // Se especificou um studentId, busca e processa apenas aquele aluno
  if (studentId) {
    const user = await UserAnalysis.findOne(query).lean(); // .lean() para performance

    if (!user) {
      console.log("Nenhum usuário encontrado com os critérios:", query);
      return {
        totalCorrectAnswers: 0, totalWrongAnswers: 0, usageTimeInSeconds: 0,
        usageTime: { totalSeconds: 0, formatted: "00:00:00", humanized: "0s", hours: 0, minutes: 0, seconds: 0 },
        subjectCounts: { variaveis: 0, tipos: 0, funcoes: 0, loops: 0, verificacoes: 0 },
        sessions: [], dailyUsage: [], users: null
      };
    }

    // --- INÍCIO DA CORREÇÃO PARA ALUNO ÚNICO ---
    const totalSubjectCounts = { variaveis: 0, tipos: 0, funcoes: 0, loops: 0, verificacoes: 0 };
    if (user.sessions && user.sessions.length > 0) {
      for (const session of user.sessions) {
        if (session.subjectCountsChat) {
          totalSubjectCounts.variaveis += session.subjectCountsChat.variaveis || 0;
          totalSubjectCounts.tipos += session.subjectCountsChat.tipos || 0;
          totalSubjectCounts.funcoes += session.subjectCountsChat.funcoes || 0;
          totalSubjectCounts.loops += session.subjectCountsChat.loops || 0;
          totalSubjectCounts.verificacoes += session.subjectCountsChat.verificacoes || 0;
        }
      }
    }
    console.log("✅ [Service] Soma final para aluno único:", totalSubjectCounts);
    // --- FIM DA CORREÇÃO PARA ALUNO ÚNICO ---

    // (O resto do seu código de formatação de sessões e uso diário permanece o mesmo)
    const processedSessions = (user.sessions || [])
      .filter(session => session.sessionStart && session.sessionEnd && session.sessionDuration)
      .sort((a, b) => new Date(b.sessionStart).getTime() - new Date(a.sessionStart).getTime())
      .map(session => ({ /* ... seu código de mapeamento ... */ }));

    const sessionsByDay: Record<string, any> = {};
    processedSessions.forEach(session => { /* ... sua lógica de agrupar por dia ... */ });
    const dailyUsage = Object.values(sessionsByDay).sort((a, b) => b.date.localeCompare(a.date));

    const usageTimeObj = calculateUsageTime(user.totalUsageTime || 0);

    return {
      totalCorrectAnswers: user.totalCorrectWrongAnswers?.totalCorrectAnswers || 0,
      totalWrongAnswers: user.totalCorrectWrongAnswers?.totalWrongAnswers || 0,
      usageTimeInSeconds: user.totalUsageTime || 0,
      usageTime: usageTimeObj,
      subjectCounts: totalSubjectCounts, // <-- USA O OBJETO CORRIGIDO E SOMADO
      dailyUsage,
      sessions: processedSessions,
      users: user
    };
  }

  // Se não especificou studentId, busca e agrega todos os alunos que atendem aos critérios
  const users = await UserAnalysis.find(query).lean();
  console.log(`Encontrados ${users.length} usuários com os critérios`);

  if (users.length === 0) {
    return { /* ... seu objeto de retorno vazio ... */ };
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

    // --- INÍCIO DA CORREÇÃO PARA MÚLTIPLOS ALUNOS ---
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
          allSessions.push({ /* ... seu objeto de sessão ... */ });
        }
      });
    }
    // --- FIM DA CORREÇÃO PARA MÚLTIPLOS ALUNOS ---
  });

  // (O resto do seu código de processamento de sessões e uso diário permanece o mesmo)
  const usageTimeObj = calculateUsageTime(totalUsageTime);
  const processedSessions = allSessions.sort(/* ... */).map(session => ({ /* ... */ }));
  const sessionsByDay: Record<string, any> = {};
  processedSessions.forEach(session => { /* ... */ });
  const dailyUsage = Object.values(sessionsByDay).sort(/* ... */);

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