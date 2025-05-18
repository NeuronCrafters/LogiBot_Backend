import { Course } from "../../../../models/Course";
import { User } from "../../../../models/User";
import { UserAnalysis } from "../../../../models/UserAnalysis";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsCourseAccuracyCompareService(courseIds: string[]) {
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

            const correct = courseAnalyses.reduce((sum, a) => sum + (a.totalCorrectAnswers || 0), 0);
            const wrong = courseAnalyses.reduce((sum, a) => sum + (a.totalWrongAnswers || 0), 0);
            const total = correct + wrong;

            results.push({
                courseId,
                courseName,
                correct,
                wrong,
                total,
                studentCount: courseStudents.length,
                accuracyRate: total > 0 ? (correct / total) * 100 : 0
            });
        }

        return results;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao comparar acurácia entre cursos", 500);
    }
}