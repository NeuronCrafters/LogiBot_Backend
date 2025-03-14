import { Request, Response } from "express";
import { RasaGetLogsService } from "../../services/rasa/rasaGetLogService";
import { AppError } from "../../exceptions/AppError";
import jwt from "jsonwebtoken";

class RasaGetLogsController {
  async handle(req: Request, res: Response) {
    try {
      // extrai o token do usuário
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new AppError("Token não fornecido.", 401);
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        throw new AppError("Token inválido.", 401);
      }

      // decodifica o token para obter os dados do usuário
      let userId: string, role: string[], courseId: string | null = null;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id?: string; role?: string[]; course?: string };
        if (!decoded.id || !decoded.role) {
          throw new AppError("Token inválido ou expirado.", 401);
        }
        userId = decoded.id;
        role = decoded.role;
        courseId = decoded.course || null;
      } catch (error) {
        throw new AppError("Token inválido ou expirado.", 401);
      }

      console.log(`[DEBUG] Usuário autenticado: ${userId}, Role: ${role}`);

      let filters: any = {};

      // verifica qual tipo de usuário está acessando
      if (role.includes("admin")) {
        // Admin pode ver todos os logs, sem restrição
        filters = {};
      } else if (role.includes("coordinator")) {
        // coordenador pode ver apenas os logs dos alunos do seu curso
        if (!courseId) {
          throw new AppError("Coordenador sem curso associado.", 403);
        }
        filters.courseId = courseId;
      } else if (role.includes("professor")) {
        // professor pode ver apenas os alunos das disciplinas que ele ensina
        filters.professorId = userId;
      } else {
        throw new AppError("Permissão negada.", 403);
      }

      // chama o serviço para buscar os logs filtrados
      const rasaGetLogsService = new RasaGetLogsService();
      const logs = await rasaGetLogsService.getLogs(filters);

      return res.json(logs);
    } catch (error) {
      console.error("[RasaGetLogsController] Erro ao processar logs:", error);
      return res.status(error.statusCode || 500).json({ error: error.message || "Erro interno no servidor." });
    }
  }
}

export { RasaGetLogsController };
