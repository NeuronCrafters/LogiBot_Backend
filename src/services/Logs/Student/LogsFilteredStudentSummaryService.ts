import { UserAnalysis } from "../../../models/UserAnalysis";
import { calculateUsageTime } from "../../../utils/TimeFormatter";

export async function LogsFilteredStudentSummaryService(
  universityId: string,
  courseId?: string,
  classId?: string,
  studentId?: string
) {
  console.log("Buscando dados filtrados:", { universityId, courseId, classId, studentId });

  // Constrói a query dinamicamente
  const query: any = { schoolId: universityId };

  if (courseId) query.courseId = courseId;
  if (classId) query.classId = classId;
  if (studentId) query.userId = studentId;

  // Se especificou um studentId, busca apenas aquele aluno
  if (studentId) {
    const user = await UserAnalysis.findOne(query);

    if (!user) {
      console.log("Nenhum usuário encontrado com os critérios:", query);
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
        },
        sessions: [],
        dailyUsage: [],
        users: null
      };
    }

    // Processa os dados do usuário único
    const processedSessions = (user.sessions || [])
      .filter(session => session.sessionStart && session.sessionEnd && session.sessionDuration)
      .sort((a, b) => b.sessionStart.getTime() - a.sessionStart.getTime())
      .map(session => {
        const durationInMinutes = session.sessionDuration! / 60;
        const formattedDuration = calculateUsageTime(session.sessionDuration!).formatted;
        const date = session.sessionStart.toISOString().split('T')[0];

        return {
          date,
          sessionStart: session.sessionStart,
          sessionEnd: session.sessionEnd,
          sessionDuration: session.sessionDuration,
          durationInMinutes,
          usage: durationInMinutes,
          formatted: formattedDuration,
          userId: user.userId,
          userName: user.name,
          courseName: user.courseName,
          className: user.className
        };
      });

    // Agrupa as sessões por dia
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

      const totalSecondsForDay = sessionsByDay[session.date].usage * 60;
      sessionsByDay[session.date].formatted = calculateUsageTime(totalSecondsForDay).formatted;
    });

    const dailyUsage = Object.values(sessionsByDay)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    const usageTimeObj = calculateUsageTime(user.totalUsageTime || 0);

    return {
      totalCorrectAnswers: user.totalCorrectWrongAnswers?.totalCorrectAnswers || 0,
      totalWrongAnswers: user.totalCorrectWrongAnswers?.totalWrongAnswers || 0,
      usageTimeInSeconds: user.totalUsageTime || 0,
      usageTime: usageTimeObj,
      subjectCounts: user.subjectCountsQuiz || {
        variaveis: 0,
        tipos: 0,
        funcoes: 0,
        loops: 0,
        verificacoes: 0
      },
      dailyUsage,
      sessions: processedSessions,
      users: {
        _id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        schoolId: user.schoolId,
        schoolName: user.schoolName,
        courseId: user.courseId,
        courseName: user.courseName,
        classId: user.classId,
        className: user.className,
        totalUsageTime: user.totalUsageTime || 0,
        usageTime: usageTimeObj,
        totalCorrectWrongAnswers: user.totalCorrectWrongAnswers || {
          totalCorrectAnswers: 0,
          totalWrongAnswers: 0
        },
        subjectCounts: user.subjectCountsQuiz || {
          variaveis: 0,
          tipos: 0,
          funcoes: 0,
          loops: 0,
          verificacoes: 0
        },
        sessions: user.sessions || [],
        dailyUsage
      }
    };
  }

  // Se não especificou studentId, busca todos os alunos que atendem aos critérios
  const users = await UserAnalysis.find(query);

  console.log(`Encontrados ${users.length} usuários com os critérios`);

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
      },
      sessions: [],
      dailyUsage: []
    };
  }

  // Agrega os dados de todos os usuários
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

  const allSessions: Array<any> = [];

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
      sessionsByDay[session.date] = {
        date: session.date,
        usage: 0,
        formatted: "00:00:00",
        sessions: []
      };
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
    subjectCounts,
    dailyUsage,
    sessions: processedSessions
  };
}