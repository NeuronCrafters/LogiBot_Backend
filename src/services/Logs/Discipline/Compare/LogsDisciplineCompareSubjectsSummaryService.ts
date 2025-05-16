import { UserAnalysis } from "../../../../models/UserAnalysis";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineCompareSubjectsSummaryService(disciplineIds: string[]) {
    try {
        const results = await Promise.all(
            disciplineIds.map(async (disciplineId) => {
                const users = await UserAnalysis.find({ disciplines: disciplineId });

                const totalFrequency: Record<string, number> = {};

                users.forEach((user) => {
                    const freq = user.subjectFrequencyGlobal || {};
                    Object.entries(freq).forEach(([subject, count]) => {
                        totalFrequency[subject] = (totalFrequency[subject] || 0) + (count as number);
                    });
                });

                return {
                    disciplineId,
                    subjects: totalFrequency,
                };
            })
        );

        return results;
    } catch (error) {
        throw new AppError("Erro ao comparar assuntos por disciplina", 500, error);
    }
}
