import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { University } from "../../../../models/University";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsUniversityCompareAccuracyService(universityIds: string[]) {
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
          correct: 0,
          wrong: 0,
          accuracyRate: 0,
          studentCount: 0
        });
        continue;
      }

      const userIds = users.map(u => u._id.toString());
      const logs = await UserAnalysis.find({ userId: { $in: userIds } });

      const correct = logs.reduce((acc, curr) => acc + (curr.totalCorrectAnswers || 0), 0);
      const wrong = logs.reduce((acc, curr) => acc + (curr.totalWrongAnswers || 0), 0);
      const total = correct + wrong;

      results.push({
        universityId,
        universityName,
        correct,
        wrong,
        total,
        studentCount: users.length,
        accuracyRate: total > 0 ? (correct / total) * 100 : 0
      });
    }

    return results;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Erro na comparação de acertos e erros entre universidades", 500);
  }
}