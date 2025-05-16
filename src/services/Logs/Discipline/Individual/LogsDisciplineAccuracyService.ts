import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineAccuracyService(disciplineId: string) {
    try {
        const users = await User.find({ disciplines: disciplineId });
        const userIds = users.map((u) => u._id.toString());

        const userAnalyses = await UserAnalysis.find({ userId: { $in: userIds } });

        let totalCorrect = 0;
        let totalWrong = 0;

        userAnalyses.forEach((ua) => {
            totalCorrect += ua.totalCorrectAnswers || 0;
            totalWrong += ua.totalWrongAnswers || 0;
        });

        return { totalCorrect, totalWrong };
    } catch (error) {
        throw new AppError("Erro ao calcular acertos/erros da disciplina", 500);
    }
}
