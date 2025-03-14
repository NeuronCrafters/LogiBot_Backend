import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";

class RasaGetLogsService {
  async getLogs(filters: any) {
    try {
      let query: any = {};

      // se for um coordenador, filtra pelo curso dele
      if (filters.courseId) {
        query.courses = filters.courseId;
      }

      // se for um professor, filtra pelos alunos das disciplinas dele
      if (filters.professorId) {
        query["sessions.interactions.professorId"] = filters.professorId;
      }

      // busca os registros de acordo com os filtros
      const logs = await UserAnalysis.find(query, {
        userId: 1,
        name: 1,
        email: 1,
        school: 1,
        courses: 1,
        classes: 1,
        "sessions.interactions": 1,
      });

      if (!logs.length) {
        throw new AppError("Nenhum dado encontrado para os filtros fornecidos.", 404);
      }

      return logs;
    } catch (error) {
      console.error("[RasaGetLogsService] Erro ao buscar logs:", error);
      throw new AppError("Erro interno ao buscar logs.", 500);
    }
  }
}

export { RasaGetLogsService };
