import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { University } from "../../../../models/University";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsUniversityCompareUsageService(universityIds: string[]) {
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
          totalUsageTime: 0,
          studentCount: 0,
          averageTimePerStudent: 0,
          totalSessions: 0,
          averageSessionsPerStudent: 0
        });
        continue;
      }

      const userIds = users.map(u => u._id.toString());
      const logs = await UserAnalysis.find({ userId: { $in: userIds } });

      const totalUsageTime = logs.reduce((acc, curr) => acc + (curr.totalUsageTime || 0), 0);
      const studentCount = logs.length;
      const averageTimePerStudent = studentCount > 0 ? totalUsageTime / studentCount : 0;

      const totalSessions = logs.reduce((sum, a) => sum + a.sessions.length, 0);
      const averageSessionsPerStudent = studentCount > 0 ? totalSessions / studentCount : 0;

      results.push({
        universityId,
        universityName,
        totalUsageTime,
        studentCount,
        averageTimePerStudent,
        totalSessions,
        averageSessionsPerStudent
      });
    }

    return results;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Erro na comparação de uso entre universidades", 500);
  }
}