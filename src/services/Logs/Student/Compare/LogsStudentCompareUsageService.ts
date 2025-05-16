import { UserAnalysis } from "../../../../models/UserAnalysis";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentCompareUsageService(studentIds: string[]) {
    try {
        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        return analyses.map((a) => ({
            studentId: a.userId,
            usage: a.totalUsageTime || 0,
        }));
    } catch (error) {
        throw new AppError("Erro ao comparar tempo de uso dos estudantes", 500);
    }
}