import { AppError } from "../../../../exceptions/AppError";
import { UserAnalysis } from "../../../../models/UserAnalysis";
import { Class } from "../../../../models/Class";

export async function LogsClassAccuracyService(classId: string) {
    try {
        const classDoc = await Class.findById(classId).populate("students");

        if (!classDoc) {
            throw new AppError("Turma não encontrada", 404);
        }

        const students = classDoc.students;
        const studentIds = students.map((s: any) => s._id.toString());

        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        const totalCorrect = analyses.reduce((sum, a) => sum + a.totalCorrectAnswers, 0);
        const totalWrong = analyses.reduce((sum, a) => sum + a.totalWrongAnswers, 0);

        return {
            correctAnswers: totalCorrect,
            wrongAnswers: totalWrong,
        };
    } catch (error) {
        throw new AppError("Erro ao calcular acertos/erros da turma", 500, error);
    }
}
