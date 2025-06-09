// src/services/Logs/Student/ProfessorStudentsService.ts
import { UserAnalysis } from "../../../models/UserAnalysis";
import { Discipline } from "../../../models/Discipline";
import { calculateUsageTime } from "../../../utils/TimeFormatter";
import { Types } from "mongoose";

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
    console.log("\n========== INÍCIO ProfessorStudentsService.getStudentData ==========");

    try {
      // 1. Debug dos parâmetros recebidos
      console.log("1️⃣ [SERVICE] Parâmetros recebidos:");
      console.log("   - professor._id:", professor._id);
      console.log("   - professor.name:", professor.name);
      console.log("   - studentId:", studentId);
      console.log("   - disciplineId:", disciplineId);
      console.log("   - classId:", classId);
      console.log("   - professor.disciplines (IDs):", professor.disciplines?.map((d: any) => d._id || d));

      // 2. Construindo query para disciplinas
      let disciplineQuery: any = {
        _id: { $in: professor.disciplines },
        professors: professor._id
      };

      if (disciplineId) {
        console.log("   - Filtrando por disciplina específica:", disciplineId);
        disciplineQuery._id = disciplineId;
      }

      console.log("\n2️⃣ [SERVICE] Query para buscar disciplinas:");
      console.log("   ", JSON.stringify(disciplineQuery, null, 2));

      // 3. Buscando disciplinas
      const professorDisciplines = await Discipline.find(disciplineQuery);

      console.log("\n3️⃣ [SERVICE] Disciplinas encontradas:");
      console.log("   - Quantidade:", professorDisciplines.length);
      professorDisciplines.forEach((disc, index) => {
        console.log(`   - Disciplina ${index + 1}:`);
        console.log(`     * ID: ${disc._id}`);
        console.log(`     * Nome: ${disc.name}`);
        console.log(`     * Código: ${disc.code}`);
        console.log(`     * Alunos: ${disc.students.length} [${disc.students.slice(0, 3).join(', ')}${disc.students.length > 3 ? '...' : ''}]`);
        console.log(`     * Turmas: ${disc.classes.length} [${disc.classes.join(', ')}]`);
      });

      if (professorDisciplines.length === 0) {
        console.log("   ❌ Nenhuma disciplina encontrada!");
        console.log("========== FIM ProfessorStudentsService (sem disciplinas) ==========\n");

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

      // 4. Coletando IDs permitidos
      const allowedStudentIds = new Set<string>();
      const allowedClassIds = new Set<string>();

      professorDisciplines.forEach(discipline => {
        discipline.students.forEach(studentId => {
          allowedStudentIds.add(studentId.toString());
        });

        discipline.classes.forEach((classRef: any) => {
          const classId = typeof classRef === 'object' ? classRef._id : classRef;
          allowedClassIds.add(classId.toString());
        });
      });

      console.log("\n4️⃣ [SERVICE] IDs permitidos:");
      console.log("   - Alunos permitidos:", Array.from(allowedStudentIds));
      console.log("   - Turmas permitidas:", Array.from(allowedClassIds));

      // 5. Construindo query para UserAnalysis
      const query: any = {
        schoolId: professor.school._id || professor.school
      };

      // Verificação de acesso ao aluno específico
      if (studentId) {
        console.log("\n5️⃣ [SERVICE] Verificando acesso ao aluno:", studentId);
        console.log("   - Aluno está na lista permitida?", allowedStudentIds.has(studentId));

        if (!allowedStudentIds.has(studentId)) {
          console.log("   ❌ Professor não tem acesso a este aluno!");
          console.log("========== FIM ProfessorStudentsService (sem acesso ao aluno) ==========\n");

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

      // Verificação de turma
      if (classId) {
        console.log("   - Verificando acesso à turma:", classId);
        console.log("   - Turma está na lista permitida?", allowedClassIds.has(classId));

        if (!allowedClassIds.has(classId)) {
          console.log("   ❌ Professor não leciona nesta turma!");
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

      console.log("\n6️⃣ [SERVICE] Query final para UserAnalysis:");
      console.log("   ", JSON.stringify(query, null, 2));

      // 6. Buscando dados no UserAnalysis
      const users = studentId
        ? [await UserAnalysis.findOne(query)].filter(Boolean)
        : await UserAnalysis.find(query);

      console.log("\n7️⃣ [SERVICE] Resultado da busca em UserAnalysis:");
      console.log("   - Quantidade de usuários encontrados:", users.length);

      if (users.length > 0) {
        users.forEach((user, index) => {
          if (user) {
            console.log(`   - Usuário ${index + 1}:`);
            console.log(`     * userId: ${user.userId}`);
            console.log(`     * name: ${user.name}`);
            console.log(`     * email: ${user.email}`);
            console.log(`     * className: ${user.className}`);
            console.log(`     * totalUsageTime: ${user.totalUsageTime}`);
            console.log(`     * sessions: ${user.sessions?.length || 0}`);
          }
        });
      } else {
        console.log("   ❌ Nenhum usuário encontrado!");
      }

      if (users.length === 0) {
        console.log("========== FIM ProfessorStudentsService (sem usuários) ==========\n");
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

      // 7. Processamento dos dados (código existente continua...)
      console.log("\n8️⃣ [SERVICE] Processando dados...");

      // Se for busca de um único aluno
      if (studentId && users.length === 1) {
        const user = users[0];
        console.log("   - Processando dados de um único aluno");

        const processedSessions = (user.sessions || [])
          .filter(session => session.sessionStart && session.sessionEnd && session.sessionDuration)
          .sort((a, b) => b.sessionStart.getTime() - a.sessionStart.getTime());

        console.log("   - Sessões processadas:", processedSessions.length);

        // ... resto do processamento ...

        const usageTimeObj = calculateUsageTime(user.totalUsageTime || 0);

        console.log("✅ [SERVICE] Dados processados com sucesso");
        console.log("========== FIM ProfessorStudentsService ==========\n");

        // Retorna os dados (código existente continua...)
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

      // Para múltiplos alunos (agregação)
      console.log("   - Processando dados agregados de múltiplos alunos");

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

      console.log("   - Total de sessões agregadas:", allSessions.length);
      console.log("   - Tempo total de uso:", totalUsageTime);

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

      console.log("✅ [SERVICE] Dados agregados processados com sucesso");
      console.log("========== FIM ProfessorStudentsService ==========\n");

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
      console.error("\n❌ [SERVICE] ERRO:", error);
      console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
      console.log("========== FIM ProfessorStudentsService (com erro) ==========\n");
      throw error;
    }
  }
}