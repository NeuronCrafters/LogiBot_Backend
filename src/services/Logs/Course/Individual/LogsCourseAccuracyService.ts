import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsCourseAccuracyService(courseId: string) {
    try {
        const users = await User.find({ course: courseId });
        if (!users.length) throw new AppError("Nenhum aluno encontrado para este curso.");

        const userIds = users.map((user) => user._id);
        const analyses = await UserAnalysis.find({ userId: { $in: userIds } });

        const totalCorrectAnswers = analyses.reduce((acc, analysis) => acc + (analysis.totalCorrectAnswers || 0), 0);
        const totalWrongAnswers = analyses.reduce((acc, analysis) => acc + (analysis.totalWrongAnswers || 0), 0);

        return { totalCorrectAnswers, totalWrongAnswers };
    } catch (error) {
        throw new AppError("Erro ao calcular acertos/erros do curso", 500, error);
    }
}