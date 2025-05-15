import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsClassCompareSubjectSummaryService(classIds: string[]) {
    try {
        const students = await User.find({ class: { $in: classIds } }).select("_id class");
        if (!students.length) throw new AppError("Nenhum aluno encontrado nas turmas informadas");

        const userIds = students.map((s) => s._id);
        const analyses = await UserAnalysis.find({ userId: { $in: userIds } });

        const result: Record<string, Record<string, number>> = {};

        for (const student of students) {
            const analysis = analyses.find((a) => a.userId === student._id.toString());
            if (!analysis || !analysis.subjectFrequencyGlobal) continue;
            const classId = student.class.toString();

            if (!result[classId]) result[classId] = {};

            for (const [subject, count] of Object.entries(analysis.subjectFrequencyGlobal)) {
                result[classId][subject] = (result[classId][subject] || 0) + count;
            }
        }

        return result;
    } catch (error) {
        throw new AppError("Erro ao comparar assuntos mais acessados entre turmas", 500);
    }
}