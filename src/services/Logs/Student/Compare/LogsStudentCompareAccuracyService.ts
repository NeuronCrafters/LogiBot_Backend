import { UserAnalysis } from "../../../../models/UserAnalysis";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentCompareAccuracyService(studentIds: string[]) {
    try {
        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        return analyses.map((a) => ({
            studentId: a.userId,
            correct: a.totalCorrectAnswers || 0,
            wrong: a.totalWrongAnswers || 0,
        }));
    } catch (error) {
        throw new AppError("Erro ao comparar acertos/erros dos estudantes", 500);
    }
}
