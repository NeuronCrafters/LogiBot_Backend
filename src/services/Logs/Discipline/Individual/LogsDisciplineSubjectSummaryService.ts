import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineSubjectSummaryService(disciplineId: string) {
    try {
        const students = await User.find({ disciplines: disciplineId });
        const studentIds = students.map((student) => student._id.toString());

        const analyses = await UserAnalysis.find({ userId: { $in: studentIds } });

        const summary = {
            mostAccessed: {},
            leastAccessed: {},
            mostCorrect: {},
            mostWrong: {},
        };

        const freq: Record<string, number> = {};
        const corrects: Record<string, number> = {};
        const wrongs: Record<string, number> = {};

        for (const analysis of analyses) {
            const freqData = analysis.subjectFrequencyGlobal || {};
            for (const [subject, count] of Object.entries(freqData)) {
                freq[subject] = (freq[subject] || 0) + count;
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

        const sortAndPick = (obj: Record<string, number>, pick: "max" | "min") => {
            const entries = Object.entries(obj);
            if (entries.length === 0) return { subject: null, count: 0 };
            const sorted = entries.sort((a, b) => pick === "max" ? b[1] - a[1] : a[1] - b[1]);
            return { subject: sorted[0][0], count: sorted[0][1] };
        };

        summary.mostAccessed = sortAndPick(freq, "max");
        summary.leastAccessed = sortAndPick(freq, "min");
        summary.mostCorrect = sortAndPick(corrects, "max");
        summary.mostWrong = sortAndPick(wrongs, "max");

        return summary;
    } catch (error) {
        throw new AppError("Erro ao calcular resumo dos assuntos da disciplina", 500);
    }
}
