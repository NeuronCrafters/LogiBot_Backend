import { UserAnalysis } from "../../../models/UserAnalysis";
import { Discipline } from "../../../models/Discipline";
import { User } from "../../../models/User";
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
      // 1. Primeiro, vamos buscar as disciplinas do professor com base nos filtros
      let disciplineQuery: any = {
        _id: { $in: professor.disciplines },
        professors: professor._id
      };

      // Se foi especificada uma disciplina específica
      if (disciplineId) {
        disciplineQuery._id = disciplineId;
      }

      // Se foi especificada uma turma específica, filtra disciplinas que tenham essa turma
      if (classId) {
        disciplineQuery.classes = classId;
      }

      const professorDisciplines = await Discipline.find(disciplineQuery)
        .populate('students')
        .populate('classes');

      if (professorDisciplines.length === 0) {
        return this.getEmptyResponse("Nenhuma disciplina encontrada para os filtros especificados");
      }

      // 2. Coleta todos os IDs de alunos válidos das disciplinas encontradas
      const allowedStudentIds = new Set<string>();
      const allowedClassIds = new Set<string>();

      professorDisciplines.forEach(discipline => {
        discipline.students.forEach((student: any) => {
          const studentId = typeof student === 'object' ? student._id : student;
          allowedStudentIds.add(studentId.toString());
        });

        discipline.classes.forEach((classRef: any) => {
          const classId = typeof classRef === 'object' ? classRef._id : classRef;
          allowedClassIds.add(classId.toString());
        });
      });

      // 3. Valida se o aluno específico está nas disciplinas do professor
      if (studentId && !allowedStudentIds.has(studentId)) {
        return this.getEmptyResponse("Aluno não encontrado nas disciplinas do professor");
      }

      // 4. Valida se a turma específica está nas disciplinas do professor
      if (classId && !allowedClassIds.has(classId)) {
        return this.getEmptyResponse("Professor não leciona nesta turma");
      }

      // 5. Monta a query para UserAnalysis
      const query: any = {
        schoolId: professor.school._id || professor.school
      };

      // Filtra por aluno específico ou por todos os alunos permitidos
      if (studentId) {
        query.userId = studentId;
      } else {
        query.userId = { $in: Array.from(allowedStudentIds) };
      }

      // Filtra por turma se especificado
      if (classId) {
        query.classId = classId;
      }

      // 6. Busca os dados de análise dos usuários
      const users = studentId
        ? [await UserAnalysis.findOne(query)].filter(Boolean)
        : await UserAnalysis.find(query);

      if (users.length === 0) {
        return this.getEmptyResponse();
      }

      // 7. Se for um aluno específico, retorna dados detalhados
      if (studentId && users.length === 1) {
        return this.getDetailedStudentData(users[0]);
      }

      // 8. Se for múltiplos alunos, retorna dados agregados
      return this.getAggregatedStudentData(users);

    } catch (error) {
      throw error;
    }
  }

  private static getEmptyResponse(message?: string) {
    const response = {
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
      students: [],
      totalStudents: 0,
      message: message || undefined
    };

    if (message) {
      (response as any).message = message;
    }

    return response;
  }

  private static getDetailedStudentData(user: any) {
    const processedSessions = (user.sessions || [])
      .filter(
        (session) =>
          session.sessionStart && session.sessionEnd && session.sessionDuration
      )
      .sort(
        (a, b) => b.sessionStart.getTime() - a.sessionStart.getTime()
      );

    const usageTimeObj = calculateUsageTime(user.totalUsageTime || 0);

    const sessionsByDay: Record<string, any> = {};
    processedSessions.forEach((session) => {
      const durationInMinutes = session.sessionDuration! / 60;
      const formattedDuration = calculateUsageTime(
        session.sessionDuration!
      ).formatted;
      const date = session.sessionStart.toISOString().split("T")[0];

      if (!sessionsByDay[date]) {
        sessionsByDay[date] = {
          date,
          usage: 0,
          formatted: "00:00:00",
          sessions: [],
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
        className: user.className,
      });

      const totalSecondsForDay = sessionsByDay[date].usage * 60;
      sessionsByDay[date].formatted = calculateUsageTime(
        totalSecondsForDay
      ).formatted;
    });

    const dailyUsage = Object.values(sessionsByDay)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    return {
      totalCorrectAnswers:
        user.totalCorrectWrongAnswers?.totalCorrectAnswers || 0,
      totalWrongAnswers:
        user.totalCorrectWrongAnswers?.totalWrongAnswers || 0,
      usageTimeInSeconds: user.totalUsageTime || 0,
      usageTime: usageTimeObj,
      subjectCounts: user.subjectCountsQuiz || {
        variaveis: 0,
        tipos: 0,
        funcoes: 0,
        loops: 0,
        verificacoes: 0,
      },
      dailyUsage,
      sessions: processedSessions.map((session) => ({
        date: session.sessionStart.toISOString().split("T")[0],
        sessionStart: session.sessionStart,
        sessionEnd: session.sessionEnd,
        sessionDuration: session.sessionDuration,
        durationInMinutes: session.sessionDuration! / 60,
        usage: session.sessionDuration! / 60,
        formatted: calculateUsageTime(session.sessionDuration!).formatted,
        userId: user.userId,
        userName: user.name,
        courseName: user.courseName,
        className: user.className,
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
        totalCorrectWrongAnswers:
          user.totalCorrectWrongAnswers || {
            totalCorrectAnswers: 0,
            totalWrongAnswers: 0,
          },
        subjectCounts: user.subjectCountsQuiz || {
          variaveis: 0,
          tipos: 0,
          funcoes: 0,
          loops: 0,
          verificacoes: 0,
        },
        sessions: user.sessions || [],
        dailyUsage,
      },

      students: [],
      totalStudents: 1,
      message: undefined,
    };
  }

  private static getAggregatedStudentData(users: any[]) {
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
    const studentsData: any[] = [];

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

      studentsData.push({
        _id: ua._id,
        userId: ua.userId,
        name: ua.name,
        email: ua.email,
        courseName: ua.courseName || "",
        className: ua.className || "",
        totalUsageTime: ua.totalUsageTime || 0,
        usageTime: calculateUsageTime(ua.totalUsageTime || 0),
        totalCorrectAnswers: ua.totalCorrectWrongAnswers?.totalCorrectAnswers || 0,
        totalWrongAnswers: ua.totalCorrectWrongAnswers?.totalWrongAnswers || 0,
        subjectCounts: ua.subjectCountsQuiz || {
          variaveis: 0,
          tipos: 0,
          funcoes: 0,
          loops: 0,
          verificacoes: 0
        }
      });

      if (Array.isArray(ua.sessions)) {
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
      sessions: processedSessions,

      // padronizados
      students: studentsData,
      totalStudents: studentsData.length,
      users: null,
      message: undefined
    };
  }

  /**
   * Método auxiliar para listar apenas os estudantes básicos sem dados de análise
   */
  static async getStudentsList({
    professor,
    disciplineId,
    classId
  }: Omit<ProfessorStudentDataParams, 'studentId'>) {
    try {
      let disciplineQuery: any = {
        _id: { $in: professor.disciplines },
        professors: professor._id
      };

      if (disciplineId) {
        disciplineQuery._id = disciplineId;
      }

      if (classId) {
        disciplineQuery.classes = classId;
      }

      const professorDisciplines = await Discipline.find(disciplineQuery)
        .populate({
          path: 'students',
          select: 'name email course class status',
          populate: [
            { path: 'course', select: 'name' },
            { path: 'class', select: 'name' }
          ]
        });

      if (professorDisciplines.length === 0) {
        return { students: [], totalStudents: 0 };
      }

      // Coleta todos os estudantes únicos
      const studentsMap = new Map();
      professorDisciplines.forEach(discipline => {
        discipline.students.forEach((student: any) => {
          if (!studentsMap.has(student._id.toString())) {
            studentsMap.set(student._id.toString(), {
              _id: student._id,
              userId: student._id,
              name: student.name,
              email: student.email,
              courseName: student.course?.name || "",
              className: student.class?.name || "",
              status: student.status
            });
          }
        });
      });

      const students = Array.from(studentsMap.values());

      return {
        students,
        totalStudents: students.length
      };
    } catch (error) {
      throw error;
    }
  }
}