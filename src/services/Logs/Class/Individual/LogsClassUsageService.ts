import { AppError } from "../../../../exceptions/AppError";
import { UserAnalysis } from "../../../../models/UserAnalysis";
import { Class } from "../../../../models/Class";

export async function LogsClassUsageService(classId: string) {
    try {
        const classDoc = await Class.findById(classId).populate("students");

        if (!classDoc) {
            throw new AppError("Turma não encontrada", 404);
        }

        const students = classDoc.students;
        const studentIds = students.map((s: any) => s._id.toString());

        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        const totalTime = analyses.reduce((sum, a) => sum + (a.totalUsageTime || 0), 0);
        const studentCount = analyses.length;

        // Calcular média por aluno
        const averageTimePerStudent = studentCount > 0 ? totalTime / studentCount : 0;

        // Calcular dados de sessões
        const totalSessions = analyses.reduce((sum, a) => sum + a.sessions.length, 0);
        const averageSessionsPerStudent = studentCount > 0 ? totalSessions / studentCount : 0;

        // NOVO: Calcular dados de uso por dia para o gráfico de linha
        const usageByDay = new Map<string, number>();

        for (const analysis of analyses) {
            for (const session of analysis.sessions) {
                if (session.sessionStart) {
                    const sessionDate = new Date(session.sessionStart);
                    const day = sessionDate.toISOString().split('T')[0];
                    const duration = session.sessionDuration || 0;

                    usageByDay.set(day, (usageByDay.get(day) || 0) + duration);
                }
            }
        }

        // Converter para array para retornar ao front
        const sessionDetails = Array.from(usageByDay, ([day, minutes]) => ({
            sessionStart: new Date(day),
            sessionDuration: minutes
        }));

        return {
            totalUsageTime: totalTime,
            studentCount,
            averageTimePerStudent,
            totalSessions,
            averageSessionsPerStudent,
            sessionDetails // Novo campo para compatibilidade com UsageChart
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao calcular tempo de uso da turma", 500);
    }
}