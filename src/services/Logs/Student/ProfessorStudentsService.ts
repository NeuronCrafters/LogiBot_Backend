import { UserAnalysis } from "../../../models/UserAnalysis";
import { Discipline } from "../../../models/Discipline";
import { calculateUsageTime } from "../../../utils/TimeFormatter";

interface ProfessorStudentDataParams {
  professor: any;
  studentId?: string;
  disciplineId?: string;
  classId?: string;
}

export class ProfessorStudentsService {
  static async getStudentData({
    professor,
    studentId,
    disciplineId,
    classId
  }: ProfessorStudentDataParams) {
    try {
      let disciplineQuery: any = {
        _id: { $in: professor.disciplines },
        professors: professor._id
      };

      if (disciplineId) {
        disciplineQuery._id = disciplineId;
      }

      const professorDisciplines = await Discipline.find(disciplineQuery);

      if (professorDisciplines.length === 0) {
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

      const allowedStudentIds = new Set<string>();
      const allowedClassIds = new Set<string>();

      professorDisciplines.forEach(discipline => {
        discipline.students.forEach(studentId => allowedStudentIds.add(studentId.toString()));
        discipline.classes.forEach((classRef: any) => {
          const classId = typeof classRef === 'object' ? classRef._id : classRef;
          allowedClassIds.add(classId.toString());
        });
      });

      const query: any = { schoolId: professor.school._id || professor.school };

      if (studentId) {
        if (!allowedStudentIds.has(studentId)) {
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
            users: null,
            message: "Aluno não encontrado nas disciplinas do professor"
          };
        }
        query.userId = studentId;
      } else {
        query.userId = { $in: Array.from(allowedStudentIds) };
      }

      if (classId) {
        if (!allowedClassIds.has(classId)) {
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
            users: null,
            message: "Professor não leciona nesta turma"
          };
        }
        query.classId = classId;
      }

      const users = studentId
        ? [await UserAnalysis.findOne(query)].filter(Boolean)
        : await UserAnalysis.find(query);

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

      if (studentId && users.length === 1) {
        const user = users[0];
        const processedSessions = (user.sessions || [])
          .filter(session => session.sessionStart && session.sessionEnd && session.sessionDuration)
          .sort((a, b) => b.sessionStart.getTime() - a.sessionStart.getTime());

        const usageTimeObj = calculateUsageTime(user.totalUsageTime || 0);

        const sessionsByDay: Record<string, any> = {};
        processedSessions.forEach(session => {
          const durationInMinutes = session.sessionDuration! / 60;
          const formattedDuration = calculateUsageTime(session.sessionDuration!).formatted;
          const date = session.sessionStart.toISOString().split('T')[0];

          if (!sessionsByDay[date]) {
            sessionsByDay[date] = {
              date: date,
              usage: 0,
              formatted: "00:00:00",
              sessions: []
            };
          }

          sessionsByDay[date].usage += durationInMinutes;
          sessionsByDay[date].sessions.push({
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
          });

          const totalSecondsForDay = sessionsByDay[date].usage * 60;
          sessionsByDay[date].formatted = calculateUsageTime(totalSecondsForDay).formatted;
        });

        const dailyUsage = Object.values(sessionsByDay)
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 30);

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
          sessions: processedSessions.map(session => ({
            date: session.sessionStart.toISOString().split('T')[0],
            sessionStart: session.sessionStart,
            sessionEnd: session.sessionEnd,
            sessionDuration: session.sessionDuration,
            durationInMinutes: session.sessionDuration! / 60,
            usage: session.sessionDuration! / 60,
            formatted: calculateUsageTime(session.sessionDuration!).formatted,
            userId: user.userId,
            userName: user.name,
            courseName: user.courseName,
            className: user.className
          })),
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
          Object.keys(subjectCounts).forEach(key => {
            if (typeof ua.subjectCountsQuiz[key] === 'number') {
              subjectCounts[key] += ua.subjectCountsQuiz[key];
            }
          });
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
    } catch (error) {
      throw error;
    }
  }
}
