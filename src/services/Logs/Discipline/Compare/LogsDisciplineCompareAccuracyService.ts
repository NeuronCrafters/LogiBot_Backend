import { UserAnalysis } from "../../../../models/UserAnalysis";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineCompareAccuracyService(disciplineIds: string[]) {
    try {
        const results = await Promise.all(
            disciplineIds.map(async (disciplineId) => {
                const users = await UserAnalysis.find({ "email": { $exists: true }, disciplines: disciplineId });

                const correct = users.reduce((acc, user) => acc + (user.totalCorrectAnswers || 0), 0);
                const wrong = users.reduce((acc, user) => acc + (user.totalWrongAnswers || 0), 0);

                return {
                    disciplineId,
                    correct,
                    wrong,
                };
            })
        );

        return results;
    } catch (error) {
        throw new AppError("Erro ao comparar acertos/erros por disciplina", 500, error);
    }
}