import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { Course } from "../../../../models/Course";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsCourseUsageService(courseId: string) {
    try {
        const course = await Course.findById(courseId);
        if (!course) {
            throw new AppError("Curso não encontrado", 404);
        }

        const users = await User.find({ course: courseId });
        if (!users.length) {
            throw new AppError("Nenhum aluno encontrado para este curso", 404);
        }

        const userIds = users.map((user) => user._id);
        const analyses = await UserAnalysis.find({ userId: { $in: userIds } });

        const totalUsageTime = analyses.reduce((acc, analysis) => acc + (analysis.totalUsageTime || 0), 0);
        const studentCount = analyses.length;

        // Calcular métricas adicionais
        const averageTimePerStudent = studentCount > 0 ? totalUsageTime / studentCount : 0;
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
            courseName: course.name,
            totalUsageTime,
            studentCount,
            averageTimePerStudent,
            totalSessions,
            averageSessionsPerStudent,
            sessionDetails // Novo campo para compatibilidade com UsageChart
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao calcular tempo de uso do curso", 500);
    }
}