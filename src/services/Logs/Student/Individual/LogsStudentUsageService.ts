import { UserAnalysis } from "../../../../models/UserAnalysis";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentUsageService(studentId: string) {
    try {
        const analysis = await UserAnalysis.findOne({ userId: studentId });
        if (!analysis) {
            throw new AppError("Análise do estudante não encontrada", 404);
        }

        return { totalUsageTime: analysis.totalUsageTime || 0 };
    } catch (error) {
        throw new AppError("Erro ao buscar tempo de uso do estudante", 500);
    }
}
