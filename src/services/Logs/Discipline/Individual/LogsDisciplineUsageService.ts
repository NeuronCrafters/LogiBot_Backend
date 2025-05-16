import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineUsageService(disciplineId: string) {
    try {
        const students = await User.find({ disciplines: disciplineId });
        const studentIds = students.map((student) => student._id.toString());

        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        const totalUsage = analyses.reduce((acc, analysis) => acc + (analysis.totalUsageTime || 0), 0);

        return { totalUsageTime: totalUsage };
    } catch (error) {
        throw new AppError("Erro ao calcular tempo de uso da disciplina", 500);
    }
}