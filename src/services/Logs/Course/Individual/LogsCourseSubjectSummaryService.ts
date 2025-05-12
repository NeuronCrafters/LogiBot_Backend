import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsCourseSubjectSummaryService(courseId: string) {
    try {
        const users = await User.find({ course: courseId });
        if (!users.length) throw new AppError("Nenhum aluno encontrado para este curso.");

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

        return { frequency, corrects, wrongs };
    } catch (error) {
        throw new AppError("Erro ao calcular resumo de assuntos do curso", 500, error);
    }
}