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

        return {
            disciplineName: discipline.name,
            totalUsageTime: totalUsage,
            studentCount,
            averageTimePerStudent,
            totalSessions,
            averageSessionsPerStudent
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao calcular tempo de uso da disciplina", 500);
    }
}