import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentCompareAccuracyService(studentIds: string[]) {
    try {
        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            throw new AppError("Lista de IDs de estudantes inválida", 400);
        }

        // Buscar os nomes dos estudantes junto com as análises para melhor identificação
        const users = await User.find({ _id: { $in: studentIds } }).select("_id name");
        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        const results = studentIds.map(id => {
            const analysis = analyses.find(a => a.userId === id);
            const user = users.find(u => u._id.toString() === id);

            if (!analysis) {
                return {
                    studentId: id,
                    name: user?.name || "Desconhecido",
                    correct: 0,
                    wrong: 0,
                    accuracyRate: 0
                };
            }

            const total = (analysis.totalCorrectAnswers || 0) + (analysis.totalWrongAnswers || 0);

            return {
                studentId: id,
                name: user?.name || "Desconhecido",
                correct: analysis.totalCorrectAnswers || 0,
                wrong: analysis.totalWrongAnswers || 0,
                accuracyRate: total > 0 ? ((analysis.totalCorrectAnswers || 0) / total) * 100 : 0
            };
        });

        return results;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao comparar acertos/erros dos estudantes", 500);
    }
}