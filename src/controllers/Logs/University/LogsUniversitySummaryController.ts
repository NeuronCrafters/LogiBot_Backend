import { Request, Response } from "express";
import { LogsUniversitySummaryService } from "../../../services/Logs/University/LogsUniversitySummaryService";
import { isAdmin } from "../../../utils/RoleChecker";

export async function LogsUniversitySummaryController(req: Request, res: Response) {
  try {
    const { universityId } = req.params;
    const userRole: string[] = req.user.role;

    console.log("requisição para resumo de universidade:", universityId);

    if (!universityId) {
      return res.status(400).json({ message: "O ID da universidade é obrigatório." });
    }

    if (isAdmin(userRole)) {
      console.log("usuário admin acessando dados");
      const summary = await LogsUniversitySummaryService(universityId);
      return res.status(200).json(summary);
    }

    console.log("acesso negado");
    return res.status(403).json({ message: "Apenas administradores podem acessar os dados da universidade." });
  } catch (error) {
    console.error("[logsuniversitysummarycontroller] erro:", error);
    return res.status(500).json({ message: "Erro ao obter dados da universidade." });
  }
}
