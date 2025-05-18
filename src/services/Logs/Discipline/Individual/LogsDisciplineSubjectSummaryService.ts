import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { Discipline } from "../../../../models/Discipline";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineSubjectSummaryService(disciplineId: string) {
    try {
        const discipline = await Discipline.findById(disciplineId);
        if (!discipline) {
            throw new AppError("Disciplina não encontrada", 404);
        }

        const students = await User.find({ disciplines: disciplineId });
        if (!students.length) {
            throw new AppError("Nenhum aluno encontrado para esta disciplina", 404);
        }

        const studentIds = students.map((student) => student._id.toString());
        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        const freq: Record<string, number> = {};
        const corrects: Record<string, number> = {};
        const wrongs: Record<string, number> = {};

        for (const analysis of analyses) {
            const freqData = analysis.subjectFrequencyGlobal || {};
            for (const [subject, count] of Object.entries(freqData)) {
                freq[subject] = (freq[subject] || 0) + Number(count);
            }
            for (const session of analysis.sessions || []) {
                for (const hist of session.answerHistory || []) {
                    for (const q of hist.questions || []) {
                        if (q.subject) {
                            if (q.totalCorrectAnswers) {
                                corrects[q.subject] = (corrects[q.subject] || 0) + q.totalCorrectAnswers;
                            }
                            if (q.totalWrongAnswers) {
                                wrongs[q.subject] = (wrongs[q.subject] || 0) + q.totalWrongAnswers;
                            }
                        }
                    }
                }
            }
        }

        // Ordenar por frequência
        const rankedByFrequency = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .map(([subject, count]) => ({ subject, count }));

        // Ordenar por acertos
        const rankedByCorrect = Object.entries(corrects)
            .sort((a, b) => b[1] - a[1])
            .map(([subject, count]) => ({ subject, count }));

        // Ordenar por erros
        const rankedByWrong = Object.entries(wrongs)
            .sort((a, b) => b[1] - a[1])
            .map(([subject, count]) => ({ subject, count }));

        // Identificar os mais relevantes
        const mostAccessed = rankedByFrequency.length > 0 ? rankedByFrequency[0] : { subject: null, count: 0 };
        const leastAccessed = rankedByFrequency.length > 0 ? rankedByFrequency[rankedByFrequency.length - 1] : { subject: null, count: 0 };
        const mostCorrect = rankedByCorrect.length > 0 ? rankedByCorrect[0] : { subject: null, count: 0 };
        const mostWrong = rankedByWrong.length > 0 ? rankedByWrong[0] : { subject: null, count: 0 };

        return {
            disciplineName: discipline.name,
            subjectFrequency: freq,
            rankedByFrequency,
            rankedByCorrect,
            rankedByWrong,
            mostAccessed,
            leastAccessed,
            mostCorrect,
            mostWrong,
            studentCount: students.length
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao calcular resumo dos assuntos da disciplina", 500);
    }
}