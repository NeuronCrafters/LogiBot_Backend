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
            let disciplineQuery: any = {
                _id: { $in: professor.disciplines },
                professors: professor._id
            };

            if (disciplineId) disciplineQuery._id = disciplineId;
            if (classId) disciplineQuery.classes = classId;

            const professorDisciplines = await Discipline.find(disciplineQuery)
                .populate('students')
                .populate('classes');

            if (professorDisciplines.length === 0) {
                return this.getEmptyResponse("Nenhuma disciplina encontrada para os filtros especificados");
            }

            const allowedStudentIds = new Set<string>();
            const allowedClassIds = new Set<string>();

            professorDisciplines.forEach(discipline => {
                discipline.students.forEach((student: any) => {
                    const sId = typeof student === 'object' ? student._id : student;
                    allowedStudentIds.add(sId.toString());
                });
                discipline.classes.forEach((classRef: any) => {
                    const cId = typeof classRef === 'object' ? classRef._id : classRef;
                    allowedClassIds.add(cId.toString());
                });
            });

            if (studentId && !allowedStudentIds.has(studentId)) {
                return this.getEmptyResponse("Aluno não encontrado nas disciplinas do professor");
            }
            if (classId && !allowedClassIds.has(classId)) {
                return this.getEmptyResponse("Professor não leciona nesta turma");
            }

            const query: any = {
                schoolId: professor.school._id || professor.school
            };

            if (studentId) {
                query.userId = studentId;
            } else {
                query.userId = { $in: Array.from(allowedStudentIds) };
            }

            if (classId) query.classId = classId;

            const users = studentId
                ? [await UserAnalysis.findOne(query)].filter(Boolean)
                : await UserAnalysis.find(query);

            if (users.length === 0) return this.getEmptyResponse();

            if (studentId && users.length === 1) {
                return this.getDetailedStudentData(users[0]);
            }

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
            usageTime: { totalSeconds: 0, formatted: "00:00:00", humanized: "0s", hours: 0, minutes: 0, seconds: 0 },
            subjectCounts: { variaveis: 0, tipos: 0, funcoes: 0, loops: 0, verificacoes: 0 },
            sessions: [],
            dailyUsage: [],
            users: null,
            students: [],
            totalStudents: 0,
            message: message || undefined
        };
        if (message) (response as any).message = message;
        return response;
    }

    private static getDetailedStudentData(user: any) {

        // --- CORREÇÃO: Calcular subjectCounts CHAT a partir das sessões ---
        const chatSubjectCounts = { variaveis: 0, tipos: 0, funcoes: 0, loops: 0, verificacoes: 0 };

        if (user.sessions && Array.isArray(user.sessions)) {
            user.sessions.forEach((session: any) => {
                if (session.subjectCountsChat) {
                    chatSubjectCounts.variaveis += session.subjectCountsChat.variaveis || 0;
                    chatSubjectCounts.tipos += session.subjectCountsChat.tipos || 0;
                    chatSubjectCounts.funcoes += session.subjectCountsChat.funcoes || 0;
                    chatSubjectCounts.loops += session.subjectCountsChat.loops || 0;
                    chatSubjectCounts.verificacoes += session.subjectCountsChat.verificacoes || 0;
                }
            });
        }

        const processedSessions = (user.sessions || [])
            .filter((session: any) => session.sessionStart && session.sessionEnd && session.sessionDuration)
            .sort((a: any, b: any) => b.sessionStart.getTime() - a.sessionStart.getTime());

        const usageTimeObj = calculateUsageTime(user.totalUsageTime || 0);
        const sessionsByDay: Record<string, any> = {};

        processedSessions.forEach((session: any) => {
            const durationInMinutes = session.sessionDuration! / 60;
            const formattedDuration = calculateUsageTime(session.sessionDuration!).formatted;
            const date = session.sessionStart.toISOString().split("T")[0];

            if (!sessionsByDay[date]) {
                sessionsByDay[date] = { date, usage: 0, formatted: "00:00:00", sessions: [] };
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
        });

        Object.values(sessionsByDay).forEach((day: any) => {
            const totalSeconds = day.usage * 60;
            day.formatted = calculateUsageTime(totalSeconds).formatted;
        });

        const dailyUsage = Object.values(sessionsByDay)
            .sort((a: any, b: any) => b.date.localeCompare(a.date))
            .slice(0, 30);

        return {
            totalCorrectAnswers: user.totalCorrectWrongAnswers?.totalCorrectAnswers || 0,
            totalWrongAnswers: user.totalCorrectWrongAnswers?.totalWrongAnswers || 0,
            usageTimeInSeconds: user.totalUsageTime || 0,
            usageTime: usageTimeObj,

            // AQUI: Retorna o acumulado do CHAT para o gráfico de Categoria
            subjectCounts: chatSubjectCounts,

            // Mantém o do Quiz disponível se outro gráfico precisar
            subjectCountsQuiz: user.subjectCountsQuiz,

            dailyUsage,
            sessions: processedSessions.map((session: any) => ({
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
                ...user._doc,
                usageTime: usageTimeObj,
                subjectCounts: chatSubjectCounts, // Atualiza no objeto aninhado também
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

        // Acumulador GERAL do CHAT para todos os alunos
        const chatSubjectCounts: Record<string, number> = {
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

            // Acumulador INDIVIDUAL do aluno (Chat)
            const studentChatCounts = { variaveis: 0, tipos: 0, funcoes: 0, loops: 0, verificacoes: 0 };

            if (ua.sessions && Array.isArray(ua.sessions)) {
                ua.sessions.forEach((session: any) => {
                    if (session.subjectCountsChat) {
                        // Soma no total GERAL
                        chatSubjectCounts.variaveis += session.subjectCountsChat.variaveis || 0;
                        chatSubjectCounts.tipos += session.subjectCountsChat.tipos || 0;
                        chatSubjectCounts.funcoes += session.subjectCountsChat.funcoes || 0;
                        chatSubjectCounts.loops += session.subjectCountsChat.loops || 0;
                        chatSubjectCounts.verificacoes += session.subjectCountsChat.verificacoes || 0;

                        // Soma no total INDIVIDUAL
                        studentChatCounts.variaveis += session.subjectCountsChat.variaveis || 0;
                        studentChatCounts.tipos += session.subjectCountsChat.tipos || 0;
                        studentChatCounts.funcoes += session.subjectCountsChat.funcoes || 0;
                        studentChatCounts.loops += session.subjectCountsChat.loops || 0;
                        studentChatCounts.verificacoes += session.subjectCountsChat.verificacoes || 0;
                    }

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

                // Envia o dado somado do CHAT para cada aluno na lista
                subjectCounts: studentChatCounts,
                subjectCountsQuiz: ua.subjectCountsQuiz // Mantém o Quiz original
            });
        });

        const usageTimeObj = calculateUsageTime(totalUsageTime);

        const processedSessions = allSessions
            .sort((a, b) => b.sessionStart.getTime() - a.sessionStart.getTime())
            .map(session => {
                const durationInMinutes = session.sessionDuration / 60;
                const formattedDuration = calculateUsageTime(session.sessionDuration).formatted;
                return {
                    date: session.sessionStart.toISOString().split('T')[0],
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
            const totalSeconds = sessionsByDay[session.date].usage * 60;
            sessionsByDay[session.date].formatted = calculateUsageTime(totalSeconds).formatted;
        });

        const dailyUsage = Object.values(sessionsByDay)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 30);

        return {
            totalCorrectAnswers,
            totalWrongAnswers,
            usageTimeInSeconds: totalUsageTime,
            usageTime: usageTimeObj,

            // Retorna o total agregado do CHAT
            subjectCounts: chatSubjectCounts,

            dailyUsage,
            sessions: processedSessions,
            students: studentsData,
            totalStudents: studentsData.length,
            users: null,
            message: undefined
        };
    }

    static async getStudentsList({
                                     professor,
                                     disciplineId,
                                     classId
                                 }: Omit<ProfessorStudentDataParams, 'studentId'>) {
        // ... (código existente de getStudentsList permanece inalterado) ...
        try {
            let disciplineQuery: any = {
                _id: { $in: professor.disciplines },
                professors: professor._id
            };

            if (disciplineId) disciplineQuery._id = disciplineId;
            if (classId) disciplineQuery.classes = classId;

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
            return { students, totalStudents: students.length };
        } catch (error) {
            throw error;
        }
    }
}