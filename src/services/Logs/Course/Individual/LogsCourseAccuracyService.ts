import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { Course } from "../../../../models/Course";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsCourseAccuracyService(courseId: string) {
    try {
        const course = await Course.findById(courseId);
        if (!course) {
            throw new AppError("Curso não encontrado", 404);
        }

        const users = await User.find({ course: courseId });
        if (!users.length) {
            throw new AppError("Nenhum aluno encontrado para este curso", 404);
        }

        const userIds = users.map((user) => user._id);
        const analyses = await UserAnalysis.find({ userId: { $in: userIds } });

        const totalCorrectAnswers = analyses.reduce((acc, analysis) => acc + (analysis.totalCorrectAnswers || 0), 0);
        const totalWrongAnswers = analyses.reduce((acc, analysis) => acc + (analysis.totalWrongAnswers || 0), 0);
        const totalQuestions = totalCorrectAnswers + totalWrongAnswers;

        const studentCount = analyses.length;
        const averageCorrectPerStudent = studentCount > 0 ? totalCorrectAnswers / studentCount : 0;
        const averageWrongPerStudent = studentCount > 0 ? totalWrongAnswers / studentCount : 0;

        return {
            courseName: course.name,
            totalCorrectAnswers,
            totalWrongAnswers,
            accuracyRate: totalQuestions > 0 ? (totalCorrectAnswers / totalQuestions) * 100 : 0,
            studentCount,
            averageCorrectPerStudent,
            averageWrongPerStudent
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao calcular acertos/erros do curso", 500);
    }
}