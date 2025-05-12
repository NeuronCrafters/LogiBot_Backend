import { AppError } from "../../../../exceptions/AppError";
import { UserAnalysis } from "../../../../models/UserAnalysis";
import { Class } from "../../../../models/Class";

export async function LogsClassUsageService(classId: string) {
    try {
        const classDoc = await Class.findById(classId).populate("students");

        if (!classDoc) {
            throw new AppError("Turma não encontrada", 404);
        }

        const students = classDoc.students;
        const studentIds = students.map((s: any) => s._id.toString());

        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        const totalTime = analyses.reduce((sum, a) => sum + a.totalUsageTime, 0);

        return {
            totalUsageTime: totalTime,
        };
    } catch (error) {
        throw new AppError("Erro ao calcular tempo de uso da turma", 500, error);
    }
}
