import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsCourseUsageService(courseId: string) {
    try {
        const users = await User.find({ course: courseId });
        if (!users.length) throw new AppError("Nenhum aluno encontrado para este curso.");

        const userIds = users.map((user) => user._id);
        const analyses = await UserAnalysis.find({ userId: { $in: userIds } });

        const totalUsageTime = analyses.reduce((acc, analysis) => acc + (analysis.totalUsageTime || 0), 0);

        return { totalUsageTime };
    } catch (error) {
        throw new AppError("Erro ao calcular tempo de uso do curso", 500, error);
    }
}