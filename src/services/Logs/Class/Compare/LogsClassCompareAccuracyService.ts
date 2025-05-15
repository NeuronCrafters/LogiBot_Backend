import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsClassCompareAccuracyService(classIds: string[]) {
    try {
        const students = await User.find({ class: { $in: classIds } }).select("_id name class");
        if (!students.length) throw new AppError("Nenhum aluno encontrado nas turmas informadas");

        const userIds = students.map((s) => s._id);
        const analyses = await UserAnalysis.find({ userId: { $in: userIds } });

        const groupedByClass: Record<string, { correct: number; wrong: number; total: number }> = {};

        for (const student of students) {
            const analysis = analyses.find((a) => a.userId === student._id.toString());
            if (!analysis) continue;

            const classId = student.class.toString();
            if (!groupedByClass[classId]) {
                groupedByClass[classId] = { correct: 0, wrong: 0, total: 0 };
            }

            groupedByClass[classId].correct += analysis.totalCorrectAnswers || 0;
            groupedByClass[classId].wrong += analysis.totalWrongAnswers || 0;
            groupedByClass[classId].total += 1;
        }

        return Object.entries(groupedByClass).map(([classId, data]) => ({
            classId,
            correct: data.correct,
            wrong: data.wrong,
        }));
    } catch (error) {
        throw new AppError("Erro ao comparar acertos/erros entre turmas", 500);
    }
}