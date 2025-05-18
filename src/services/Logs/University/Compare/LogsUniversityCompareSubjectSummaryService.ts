import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { University } from "../../../../models/University";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsUniversityCompareSubjectSummaryService(universityIds: string[]) {
  try {
    if (!Array.isArray(universityIds) || universityIds.length === 0) {
      throw new AppError("Lista de IDs de universidades inválida", 400);
    }

    // Buscar universidades para obter os nomes
    const universities = await University.find({ _id: { $in: universityIds } }).select("_id name");

    // Resultado para retornar
    const results = [];

    for (const university of universities) {
      const universityId = university._id.toString();
      const universityName = university.name;

      // Buscar estudantes desta universidade
      const users = await User.find({ school: universityId }).select("_id");

      if (!users.length) {
        results.push({
          universityId,
          universityName,
          subjectFrequency: {},
          rankedSubjects: [],
          mostAccessed: { subject: null, count: 0 },
          studentCount: 0
        });
        continue;
      }

      const userIds = users.map(u => u._id.toString());
      const logs = await UserAnalysis.find({ userId: { $in: userIds } });

      // Acumular frequência de assuntos
      const subjectFrequency: Record<string, number> = {};

      for (const log of logs) {
        for (const [subject, count] of Object.entries(log.subjectFrequencyGlobal || {})) {
          subjectFrequency[subject] = (subjectFrequency[subject] || 0) + Number(count);
        }
      }

      // Ordenar assuntos por frequência
      const rankedSubjects = Object.entries(subjectFrequency)
          .sort((a, b) => b[1] - a[1])
          .map(([subject, count]) => ({ subject, count }));

      const mostAccessed = rankedSubjects.length > 0 ? rankedSubjects[0] : { subject: null, count: 0 };

      results.push({
        universityId,
        universityName,
        subjectFrequency,
        rankedSubjects,
        mostAccessed,
        studentCount: users.length
      });
    }

    return results;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Erro na comparação de assuntos entre universidades", 500);
  }
}