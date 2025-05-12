import { AppError } from "../../../../exceptions/AppError";
import { UserAnalysis } from "../../../../models/UserAnalysis";
import { Class } from "../../../../models/Class";

export async function LogsClassSubjectSummaryService(classId: string) {
    try {
        const classDoc = await Class.findById(classId).populate("students");

        if (!classDoc) {
            throw new AppError("Turma não encontrada", 404);
        }

        const studentIds = classDoc.students.map((s: any) => s._id.toString());

        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        const frequency: Record<string, number> = {};
        const correctCount: Record<string, number> = {};
        const wrongCount: Record<string, number> = {};

        for (const analysis of analyses) {
            for (const [subject, count] of Object.entries(analysis.subjectFrequencyGlobal || {})) {
                frequency[subject] = (frequency[subject] || 0) + Number(count);
            }

            for (const session of analysis.sessions) {
                for (const history of session.answerHistory) {
                    for (const [sub, count] of Object.entries(history.subjectCorrectCount || {})) {
                        correctCount[sub] = (correctCount[sub] || 0) + count;
                    }
                    for (const [sub, count] of Object.entries(history.subjectWrongCount || {})) {
                        wrongCount[sub] = (wrongCount[sub] || 0) + count;
                    }
                }
            }
        }

        return {
            frequency,
            correctCount,
            wrongCount,
        };
    } catch (error) {
        throw new AppError("Erro ao calcular resumo de assuntos da turma", 500, error);
    }
}
