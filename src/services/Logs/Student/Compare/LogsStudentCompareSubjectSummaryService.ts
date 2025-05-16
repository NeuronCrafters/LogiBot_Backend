import { UserAnalysis } from "../../../../models/UserAnalysis";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentCompareSubjectSummaryService(studentIds: string[]) {
    try {
        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        return analyses.map((a) => ({
            studentId: a.userId,
            subjects: a.subjectFrequencyGlobal || {},
        }));
    } catch (error) {
        throw new AppError("Erro ao comparar resumo de assuntos dos estudantes", 500);
    }
}