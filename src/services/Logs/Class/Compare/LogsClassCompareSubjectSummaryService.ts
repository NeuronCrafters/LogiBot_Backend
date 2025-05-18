import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { Class } from "../../../../models/Class";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsClassCompareSubjectSummaryService(classIds: string[]) {
    try {
        if (!Array.isArray(classIds) || classIds.length === 0) {
            throw new AppError("Lista de IDs de turmas inválida", 400);
        }

        const classes = await Class.find({ _id: { $in: classIds } }).select("_id name");
        const students = await User.find({ class: { $in: classIds } }).select("_id class");

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

            // Acumular frequências de assuntos
            const subjectFrequency: Record<string, number> = {};

            for (const analysis of classAnalyses) {
                for (const [subject, count] of Object.entries(analysis.subjectFrequencyGlobal || {})) {
                    subjectFrequency[subject] = (subjectFrequency[subject] || 0) + Number(count);
                }
            }

            // Ordenar assuntos por frequência
            const rankedSubjects = Object.entries(subjectFrequency)
                .sort((a, b) => b[1] - a[1])
                .map(([subject, count]) => ({ subject, count }));

            const mostAccessed = rankedSubjects.length > 0 ? rankedSubjects[0] : { subject: null, count: 0 };

            result.push({
                classId,
                className,
                subjectFrequency,
                rankedSubjects,
                mostAccessed,
                studentCount: classStudents.length
            });
        }

        return result;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao comparar assuntos mais acessados entre turmas", 500);
    }
}