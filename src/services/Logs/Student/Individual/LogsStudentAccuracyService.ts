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
        };
    } catch (error) {
        throw new AppError("Erro ao buscar acertos/erros do estudante", 500);
    }
}
