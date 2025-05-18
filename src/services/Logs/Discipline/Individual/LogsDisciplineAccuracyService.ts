import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { Discipline } from "../../../../models/Discipline";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineAccuracyService(disciplineId: string) {
    try {
        const discipline = await Discipline.findById(disciplineId);
        if (!discipline) {
            throw new AppError("Disciplina não encontrada", 404);
        }

        const users = await User.find({ disciplines: disciplineId });
        if (!users.length) {
            throw new AppError("Nenhum aluno encontrado para esta disciplina", 404);
        }

        const userIds = users.map((u) => u._id.toString());
        const userAnalyses = await UserAnalysis.find({ userId: { $in: userIds } });

        let totalCorrect = 0;
        let totalWrong = 0;

        userAnalyses.forEach((ua) => {
            totalCorrect += ua.totalCorrectAnswers || 0;
            totalWrong += ua.totalWrongAnswers || 0;
        });

        const totalQuestions = totalCorrect + totalWrong;
        const studentCount = userAnalyses.length;
        const averageCorrectPerStudent = studentCount > 0 ? totalCorrect / studentCount : 0;
        const averageWrongPerStudent = studentCount > 0 ? totalWrong / studentCount : 0;

        return {
            disciplineName: discipline.name,
            totalCorrect,
            totalWrong,
            accuracyRate: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
            studentCount,
            averageCorrectPerStudent,
            averageWrongPerStudent
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao calcular acertos/erros da disciplina", 500);
    }
}