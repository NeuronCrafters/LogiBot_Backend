import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { Class } from "../../../../models/Class";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsClassCompareUsageService(classIds: string[]) {
    try {
        if (!Array.isArray(classIds) || classIds.length === 0) {
            throw new AppError("Lista de IDs de turmas inválida", 400);
        }

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

            const totalUsageTime = classAnalyses.reduce((sum, a) => sum + (a.totalUsageTime || 0), 0);
            const studentCount = classStudents.length;
            const averageTimePerStudent = studentCount > 0 ? totalUsageTime / studentCount : 0;

            result.push({
                classId,
                className,
                totalUsageTime,
                studentCount,
                averageTimePerStudent
            });
        }

        return result;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao comparar tempo de uso entre turmas", 500);
    }
}