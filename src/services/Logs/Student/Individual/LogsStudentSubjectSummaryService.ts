import { UserAnalysis } from "../../../../models/UserAnalysis";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentSubjectSummaryService(studentId: string) {
    try {
        const analysis = await UserAnalysis.findOne({ userId: studentId });
        if (!analysis) {
            throw new AppError("Análise do estudante não encontrada", 404);
        }

        return {
            subjectFrequency: analysis.subjectFrequencyGlobal || {},
        };
    } catch (error) {
        throw new AppError("Erro ao buscar resumo de assuntos do estudante", 500);
    }
}