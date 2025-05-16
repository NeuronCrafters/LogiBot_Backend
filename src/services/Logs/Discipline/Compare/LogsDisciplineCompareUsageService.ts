import { UserAnalysis } from "../../../../models/UserAnalysis";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineCompareUsageService(disciplineIds: string[]) {
    try {
        const results = await Promise.all(
            disciplineIds.map(async (disciplineId) => {
                const users = await UserAnalysis.find({ disciplines: disciplineId });

                const usage = users.reduce((acc, user) => acc + (user.totalUsageTime || 0), 0);

                return {
                    disciplineId,
                    totalUsageTime: usage,
                };
            })
        );

        return results;
    } catch (error) {
        throw new AppError("Erro ao comparar tempo de uso por disciplina", 500, error);
    }
}