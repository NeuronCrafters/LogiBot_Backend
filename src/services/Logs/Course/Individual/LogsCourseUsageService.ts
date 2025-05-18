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

        return {
            courseName: course.name,
            totalUsageTime,
            studentCount,
            averageTimePerStudent,
            totalSessions,
            averageSessionsPerStudent
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao calcular tempo de uso do curso", 500);
    }
}