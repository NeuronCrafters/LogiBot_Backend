import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { Class } from "../../../../models/Class";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsClassCompareAccuracyService(classIds: string[]) {
    try {
        if (!Array.isArray(classIds) || classIds.length === 0) {
            throw new AppError("Lista de IDs de turmas inválida", 400);
        }

        // Buscar nomes das turmas para melhor identificação
        const classes = await Class.find({ _id: { $in: classIds } }).select("_id name");
        const students = await User.find({ class: { $in: classIds } }).select("_id name class");

        if (!students.length) {
            throw new AppError("Nenhum aluno encontrado nas turmas informadas", 404);
        }

        const userIds = students.map((s) => s._id);
        const analyses = await UserAnalysis.find({ userId: { $in: userIds } });

        const result = [];

        for (const classObj of classes) {
            const classId = classObj._id.toString();
            const className = classObj.name;

            const classStudents = students.filter(s => s.class.toString() === classId);
            const studentIds = classStudents.map(s => s._id.toString());

            const classAnalyses = analyses.filter(a => studentIds.includes(a.userId));

            const correct = classAnalyses.reduce((sum, a) => sum + (a.totalCorrectAnswers || 0), 0);
            const wrong = classAnalyses.reduce((sum, a) => sum + (a.totalWrongAnswers || 0), 0);
            const total = correct + wrong;

            result.push({
                classId,
                className,
                correct,
                wrong,
                total,
                studentCount: classStudents.length,
                accuracyRate: total > 0 ? (correct / total) * 100 : 0
            });
        }

        return result;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao comparar acertos/erros entre turmas", 500);
    }
}