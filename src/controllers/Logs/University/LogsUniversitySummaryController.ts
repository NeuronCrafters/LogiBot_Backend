import { Request, Response } from "express";
import { LogsUniversitySummaryService } from "../../../services/Logs/University/LogsUniversitySummaryService";

export async function LogsUniversitySummaryController(req: Request, res: Response) {
  try {
    const { universityId } = req.params;
    const userRole = req.user.role; // ← isso deve ser string[] (ex: ["admin", "professor"])

    console.log("Requisição para resumo de universidade:", universityId);

    if (!universityId) {
      return res.status(400).json({ message: "O ID da universidade é obrigatório." });
    }

    if (!userRole.includes("admin")) {
      console.log("Acesso negado: usuário não é admin");
      return res.status(403).json({ message: "Apenas administradores podem acessar esse recurso." });
    }

    const summary = await LogsUniversitySummaryService(universityId);
    return res.status(200).json(summary);
  } catch (error) {
    console.error("[LogsUniversitySummaryController] Erro:", error);
    return res.status(500).json({ message: "Erro ao obter dados da universidade." });
  }
}