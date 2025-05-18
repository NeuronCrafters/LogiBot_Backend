import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentCompareUsageService(studentIds: string[]) {
    try {
        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            throw new AppError("Lista de IDs de estudantes inválida", 400);
        }

        const users = await User.find({ _id: { $in: studentIds } }).select("_id name");
        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        return studentIds.map(id => {
            const analysis = analyses.find(a => a.userId === id);
            const user = users.find(u => u._id.toString() === id);

            const sessionCount = analysis?.sessions.length || 0;
            const averageSessionTime = sessionCount > 0
                ? (analysis?.totalUsageTime || 0) / sessionCount
                : 0;

            return {
                studentId: id,
                name: user?.name || "Desconhecido",
                totalUsageTime: analysis?.totalUsageTime || 0,
                sessionCount,
                averageSessionTime
            };
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao comparar tempo de uso dos estudantes", 500);
    }
}