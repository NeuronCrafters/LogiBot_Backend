import { Request, Response } from "express";
import { RasaGetHistoryService } from "../../services/rasa/rasaGetHistoryService";
import jwt from "jsonwebtoken";

class RasaGetHistoryController {
  async handle(req: Request, res: Response) {
    try {
      // Verifica se o token foi enviado no cabeçalho Authorization
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        console.error("[Erro] Token JWT não fornecido no cabeçalho Authorization.");
        return res.status(401).json({ error: "Token não fornecido." });
      }

      // Extrai o token do formato "Bearer token_aqui"
      const token = authHeader.split(" ")[1];
      if (!token) {
        console.error("[Erro] Token JWT inválido.");
        return res.status(401).json({ error: "Token inválido." });
      }

      // Decodifica o token para obter o ID, papel e escola do usuário
      let userId: string | undefined;
      let userRole: string[] = [];
      let userSchool: string | null = null;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id?: string, role?: string[], school?: string };
        userId = decoded.id;
        userRole = decoded.role || [];
        userSchool = decoded.school || null;

        if (!userId) {
          console.error("[Erro] Token JWT não contém ID do usuário.");
          return res.status(401).json({ error: "Token inválido ou expirado." });
        }
      } catch (error) {
        console.error("[Erro] Falha ao verificar token JWT:", error);
        return res.status(401).json({ error: "Token inválido ou expirado." });
      }

      console.log(`[DEBUG] Usuário autenticado: ${userId} (Role: ${userRole.join(", ")})`);

      // Obtém os filtros opcionais da query
      const { studentId, classId } = req.query;

      // Converte para string caso venham como arrays
      const filters = {
        studentId: typeof studentId === "string" ? studentId : undefined,
        classId: typeof classId === "string" ? classId : undefined,
      };

      console.log("[DEBUG] Filtros aplicados:", filters);

      // Chama o serviço para buscar os dados do UserAnalysis
      const rasaGetHistoryService = new RasaGetHistoryService();
      const historyData = await rasaGetHistoryService.execute(filters, {
        id: userId,
        role: userRole,
        school: userSchool,
      });

      console.log(`[DEBUG] Dados retornados para usuário ${userId}:`, historyData.length, "registros encontrados.");

      return res.json(historyData);
    } catch (error) {
      console.error("[RasaGetHistoryController] Erro ao buscar histórico:", error);
      return res.status(500).json({ error: "Erro interno no servidor." });
    }
  }
}

export { RasaGetHistoryController };
