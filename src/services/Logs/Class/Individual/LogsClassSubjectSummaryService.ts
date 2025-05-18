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
            // Acumular frequência de assuntos
            for (const [subject, count] of Object.entries(analysis.subjectFrequencyGlobal || {})) {
                frequency[subject] = (frequency[subject] || 0) + Number(count);
            }

            // Acumular acertos/erros por assunto
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

        // Ordenar assuntos por frequência
        const rankedByFrequency = Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .map(([subject, count]) => ({ subject, count }));

        // Ordenar assuntos por acertos
        const rankedByCorrect = Object.entries(correctCount)
            .sort((a, b) => b[1] - a[1])
            .map(([subject, count]) => ({ subject, count }));

        // Ordenar assuntos por erros
        const rankedByWrong = Object.entries(wrongCount)
            .sort((a, b) => b[1] - a[1])
            .map(([subject, count]) => ({ subject, count }));

        // Identificar os mais e menos relevantes
        const mostFrequent = rankedByFrequency.length > 0 ? rankedByFrequency[0] : { subject: null, count: 0 };
        const mostCorrect = rankedByCorrect.length > 0 ? rankedByCorrect[0] : { subject: null, count: 0 };
        const mostWrong = rankedByWrong.length > 0 ? rankedByWrong[0] : { subject: null, count: 0 };

        return {
            frequency,
            correctCount,
            wrongCount,
            rankedByFrequency,
            rankedByCorrect,
            rankedByWrong,
            mostFrequent,
            mostCorrect,
            mostWrong
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao calcular resumo de assuntos da turma", 500);
    }
}