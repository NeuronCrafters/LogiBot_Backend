import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { University } from "../../../../models/University";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsUniversityUsageService(universityId: string) {
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

    const totalUsageTime = logs.reduce((acc, curr) => acc + (curr.totalUsageTime || 0), 0);
    const studentCount = logs.length;

    // Calcular métricas adicionais
    const averageTimePerStudent = studentCount > 0 ? totalUsageTime / studentCount : 0;
    const totalSessions = logs.reduce((sum, a) => sum + a.sessions.length, 0);
    const averageSessionsPerStudent = studentCount > 0 ? totalSessions / studentCount : 0;

    // NOVO: Calcular dados de uso por dia para o gráfico de linha
    const usageByDay = new Map<string, number>();

    for (const log of logs) {
      for (const session of log.sessions) {
        if (session.sessionStart) {
          const sessionDate = new Date(session.sessionStart);
          const day = sessionDate.toISOString().split('T')[0];
          const duration = session.sessionDuration || 0;

          usageByDay.set(day, (usageByDay.get(day) || 0) + duration);
        }
      }
    }

    // Converter para array para retornar ao front
    const sessionDetails = Array.from(usageByDay, ([day, minutes]) => ({
      sessionStart: new Date(day),
      sessionDuration: minutes
    }));

    return {
      universityName: university.name,
      totalUsageTime,
      studentCount,
      averageTimePerStudent,
      totalSessions,
      averageSessionsPerStudent,
      sessionDetails // Novo campo para compatibilidade com UsageChart
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Erro ao buscar tempo de uso da universidade", 500);
  }
}