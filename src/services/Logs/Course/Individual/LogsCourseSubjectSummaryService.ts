import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { Course } from "../../../../models/Course";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsCourseSubjectSummaryService(courseId: string) {
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

        const frequency: Record<string, number> = {};
        const corrects: Record<string, number> = {};
        const wrongs: Record<string, number> = {};

        analyses.forEach((analysis) => {
            Object.entries(analysis.subjectFrequencyGlobal || {}).forEach(([subject, count]) => {
                frequency[subject] = (frequency[subject] || 0) + count;
            });
            analysis.sessions.forEach((session) => {
                session.answerHistory.forEach((ah) => {
                    Object.entries(ah.subjectCorrectCount || {}).forEach(([subject, count]) => {
                        corrects[subject] = (corrects[subject] || 0) + count;
                    });
                    Object.entries(ah.subjectWrongCount || {}).forEach(([subject, count]) => {
                        wrongs[subject] = (wrongs[subject] || 0) + count;
                    });
                });
            });
        });

        // Ordenar assuntos por frequência
        const rankedByFrequency = Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .map(([subject, count]) => ({ subject, count }));

        // Ordenar assuntos por acertos
        const rankedByCorrect = Object.entries(corrects)
            .sort((a, b) => b[1] - a[1])
            .map(([subject, count]) => ({ subject, count }));

        // Ordenar assuntos por erros
        const rankedByWrong = Object.entries(wrongs)
            .sort((a, b) => b[1] - a[1])
            .map(([subject, count]) => ({ subject, count }));

        // Identificar os mais relevantes
        const mostFrequent = rankedByFrequency.length > 0 ? rankedByFrequency[0] : { subject: null, count: 0 };
        const mostCorrect = rankedByCorrect.length > 0 ? rankedByCorrect[0] : { subject: null, count: 0 };
        const mostWrong = rankedByWrong.length > 0 ? rankedByWrong[0] : { subject: null, count: 0 };

        return {
            courseName: course.name,
            frequency,
            corrects,
            wrongs,
            rankedByFrequency,
            rankedByCorrect,
            rankedByWrong,
            mostFrequent,
            mostCorrect,
            mostWrong,
            studentCount: users.length
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao calcular resumo de assuntos do curso", 500);
    }
}