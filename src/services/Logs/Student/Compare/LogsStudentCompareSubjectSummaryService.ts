import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentCompareSubjectSummaryService(studentIds: string[]) {
    try {
        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            throw new AppError("Lista de IDs de estudantes inválida", 400);
        }

        const users = await User.find({ _id: { $in: studentIds } }).select("_id name");
        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        return studentIds.map(id => {
            const analysis = analyses.find(a => a.userId === id);
            const user = users.find(u => u._id.toString() === id);
            const subjects = analysis?.subjectFrequencyGlobal || {};

            // Ordenar assuntos por frequência
            const rankedSubjects = Object.entries(subjects)
                .sort((a, b) => b[1] - a[1])
                .map(([subject, count]) => ({ subject, count }));

            const mostAccessed = rankedSubjects.length > 0 ? rankedSubjects[0] : { subject: null, count: 0 };

            return {
                studentId: id,
                name: user?.name || "Desconhecido",
                subjects,
                rankedSubjects,
                mostAccessed
            };
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao comparar resumo de assuntos dos estudantes", 500);
    }
}