import { UserAnalysis } from "../../../../models/UserAnalysis";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentSubjectSummaryService(studentId: string) {
    try {
        const analysis = await UserAnalysis.findOne({ userId: studentId });
        if (!analysis) {
            throw new AppError("Análise do estudante não encontrada", 404);
        }

        const subjectFrequency = analysis.subjectFrequencyGlobal || {};

        // Ordenar assuntos por frequência
        const rankedSubjects = Object.entries(subjectFrequency)
            .sort((a, b) => b[1] - a[1])
            .map(([subject, count]) => ({ subject, count }));

        // Identificar mais e menos acessados
        const mostAccessed = rankedSubjects.length > 0 ? rankedSubjects[0] : { subject: null, count: 0 };
        const leastAccessed = rankedSubjects.length > 0 ? rankedSubjects[rankedSubjects.length - 1] : { subject: null, count: 0 };

        return {
            subjectFrequency,
            rankedSubjects,
            mostAccessed,
            leastAccessed
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao buscar resumo de assuntos do estudante", 500);
    }
}