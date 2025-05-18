import { Course } from "../../../../models/Course";
import { User } from "../../../../models/User";
import { UserAnalysis } from "../../../../models/UserAnalysis";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsCourseSubjectSummaryCompareService(courseIds: string[]) {
    try {
        if (!Array.isArray(courseIds) || courseIds.length === 0) {
            throw new AppError("Lista de IDs de cursos inválida", 400);
        }

        // Buscar os cursos para obter os nomes
        const courses = await Course.find({ _id: { $in: courseIds } }).select("_id name");

        // Buscar todos os estudantes destes cursos
        const students = await User.find({ course: { $in: courseIds } }).select("_id course");

        if (!students.length) {
            throw new AppError("Nenhum aluno encontrado nos cursos informados", 404);
        }

        const userIds = students.map(s => s._id);
        const analyses = await UserAnalysis.find({ userId: { $in: userIds } });

        const results = [];

        for (const course of courses) {
            const courseId = course._id.toString();
            const courseName = course.name;

            const courseStudents = students.filter(s => s.course.toString() === courseId);
            const studentIds = courseStudents.map(s => s._id.toString());

            const courseAnalyses = analyses.filter(a => studentIds.includes(a.userId));

            // Acumular frequências de assuntos
            const subjectFrequency: Record<string, number> = {};

            for (const analysis of courseAnalyses) {
                for (const [subject, count] of Object.entries(analysis.subjectFrequencyGlobal || {})) {
                    subjectFrequency[subject] = (subjectFrequency[subject] || 0) + Number(count);
                }
            }

            // Ordenar assuntos por frequência
            const rankedSubjects = Object.entries(subjectFrequency)
                .sort((a, b) => b[1] - a[1])
                .map(([subject, count]) => ({ subject, count }));

            const mostAccessed = rankedSubjects.length > 0 ? rankedSubjects[0] : { subject: null, count: 0 };

            results.push({
                courseId,
                courseName,
                subjectFrequency,
                rankedSubjects,
                mostAccessed,
                studentCount: courseStudents.length
            });
        }

        return results;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao comparar resumo de assuntos entre cursos", 500);
    }
}