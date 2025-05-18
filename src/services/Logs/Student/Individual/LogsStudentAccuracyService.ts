import { UserAnalysis } from "../../../../models/UserAnalysis";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentAccuracyService(studentId: string) {
    try {
        const analysis = await UserAnalysis.findOne({ userId: studentId });
        if (!analysis) {
            throw new AppError("Análise do estudante não encontrada", 404);
        }

        return {
            totalCorrect: analysis.totalCorrectAnswers || 0,
            totalWrong: analysis.totalWrongAnswers || 0,
            accuracyRate: analysis.totalCorrectAnswers + analysis.totalWrongAnswers > 0
                ? (analysis.totalCorrectAnswers / (analysis.totalCorrectAnswers + analysis.totalWrongAnswers)) * 100
                : 0
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao buscar acertos/erros do estudante", 500);
    }
}