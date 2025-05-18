import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { University } from "../../../../models/University";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsUniversitySubjectSummaryService(universityId: string) {
  try {
    const university = await University.findById(universityId);
    if (!university) {
      throw new AppError("Universidade não encontrada", 404);
    }

    const users = await User.find({ school: universityId });
    if (!users.length) {
      throw new AppError("Nenhum aluno encontrado para esta universidade", 404);
    }

    const userIds = users.map(u => u._id.toString());
    const logs = await UserAnalysis.find({ userId: { $in: userIds } });

    const frequency: Record<string, number> = {};
    const corrects: Record<string, number> = {};
    const wrongs: Record<string, number> = {};

    for (const log of logs) {
      // Acumular frequência de assuntos
      const freq = log.subjectFrequencyGlobal || {};
      for (const key in freq) {
        frequency[key] = (frequency[key] || 0) + freq[key];
      }

      // Acumular acertos/erros por assunto
      for (const session of log.sessions) {
        for (const history of session.answerHistory) {
          for (const [subject, count] of Object.entries(history.subjectCorrectCount || {})) {
            corrects[subject] = (corrects[subject] || 0) + count;
          }
          for (const [subject, count] of Object.entries(history.subjectWrongCount || {})) {
            wrongs[subject] = (wrongs[subject] || 0) + count;
          }
        }
      }
    }

    // Ordenar por frequência
    const rankedByFrequency = Object.entries(frequency)
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
    const mostFrequent = rankedByFrequency.length > 0 ? rankedByFrequency[0] : { subject: null, count: 0 };
    const mostCorrect = rankedByCorrect.length > 0 ? rankedByCorrect[0] : { subject: null, count: 0 };
    const mostWrong = rankedByWrong.length > 0 ? rankedByWrong[0] : { subject: null, count: 0 };

    return {
      universityName: university.name,
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
    throw new AppError("Erro ao buscar resumo de assuntos da universidade", 500);
  }
}