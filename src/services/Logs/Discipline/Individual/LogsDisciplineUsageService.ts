import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { Discipline } from "../../../../models/Discipline";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineUsageService(disciplineId: string) {
    try {
        const discipline = await Discipline.findById(disciplineId);
        if (!discipline) {
            throw new AppError("Disciplina não encontrada", 404);
        }

        const students = await User.find({ disciplines: disciplineId });
        if (!students.length) {
            throw new AppError("Nenhum aluno encontrado para esta disciplina", 404);
        }

        const studentIds = students.map((student) => student._id.toString());
        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        const totalUsage = analyses.reduce((acc, analysis) => acc + (analysis.totalUsageTime || 0), 0);
        const studentCount = analyses.length;

        // Calcular métricas adicionais
        const averageTimePerStudent = studentCount > 0 ? totalUsage / studentCount : 0;
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
            disciplineName: discipline.name,
            totalUsageTime: totalUsage,
            studentCount,
            averageTimePerStudent,
            totalSessions,
            averageSessionsPerStudent,
            sessionDetails // Novo campo para compatibilidade com UsageChart
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao calcular tempo de uso da disciplina", 500);
    }
}