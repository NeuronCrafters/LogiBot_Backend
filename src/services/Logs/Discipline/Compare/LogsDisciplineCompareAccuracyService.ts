import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { Discipline } from "../../../../models/Discipline";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineCompareAccuracyService(disciplineIds: string[]) {
    try {
        if (!Array.isArray(disciplineIds) || disciplineIds.length === 0) {
            throw new AppError("Lista de IDs de disciplinas inválida", 400);
        }

        // Buscar nomes das disciplinas
        const disciplines = await Discipline.find({ _id: { $in: disciplineIds } }).select("_id name");

        // Buscar alunos de cada disciplina
        const students = await User.find({ disciplines: { $in: disciplineIds } }).select("_id disciplines");

        if (!students.length) {
            throw new AppError("Nenhum aluno encontrado nas disciplinas informadas", 404);
        }

        const userIds = students.map(s => s._id);
        const analyses = await UserAnalysis.find({ userId: { $in: userIds } });

        const results = [];

        for (const discipline of disciplines) {
            const disciplineId = discipline._id.toString();
            const disciplineName = discipline.name;

            // Alunos desta disciplina específica
            const disciplineStudents = students.filter(s =>
                s.disciplines.some((d: any) => d.toString() === disciplineId)
            );

            const studentIds = disciplineStudents.map(s => s._id.toString());
            const disciplineAnalyses = analyses.filter(a => studentIds.includes(a.userId));

            const correct = disciplineAnalyses.reduce((sum, a) => sum + (a.totalCorrectAnswers || 0), 0);
            const wrong = disciplineAnalyses.reduce((sum, a) => sum + (a.totalWrongAnswers || 0), 0);
            const total = correct + wrong;

            results.push({
                disciplineId,
                disciplineName,
                correct,
                wrong,
                total,
                studentCount: disciplineStudents.length,
                accuracyRate: total > 0 ? (correct / total) * 100 : 0
            });
        }

        return results;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao comparar acertos/erros por disciplina", 500);
    }
}