import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsClassCompareUsageService(classIds: string[]) {
    try {
        const students = await User.find({ class: { $in: classIds } }).select("_id name class");
        if (!students.length) throw new AppError("Nenhum aluno encontrado nas turmas informadas");

        const userIds = students.map((s) => s._id);
        const analyses = await UserAnalysis.find({ userId: { $in: userIds } });

        const groupedByClass: Record<string, number> = {};

        for (const student of students) {
            const analysis = analyses.find((a) => a.userId === student._id.toString());
            if (!analysis) continue;
            const classId = student.class.toString();
            groupedByClass[classId] = (groupedByClass[classId] || 0) + (analysis.totalUsageTime || 0);
        }

        return Object.entries(groupedByClass).map(([classId, usage]) => ({
            classId,
            totalUsageTime: usage,
        }));
    } catch (error) {
        throw new AppError("Erro ao comparar tempo de uso entre turmas", 500);
    }
}