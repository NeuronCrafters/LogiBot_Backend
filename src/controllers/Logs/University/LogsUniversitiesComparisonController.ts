import { Request, Response } from "express";
import { LogsUniversitiesComparisonService } from "../../../services/Logs/University/LogsUniversitiesComparisonService";

export async function LogsUniversitiesComparisonController(req: Request, res: Response) {
  try {
    const { universityId1, universityId2 } = req.body;

    if (!universityId1 || !universityId2) {
      return res.status(400).json({
        message: "Os IDs das duas universidades são obrigatórios."
      });
    }

    const userRole: string[] = req.user.role;

    // Verificar se o usuário tem permissão de admin
    if (!userRole.includes("admin")) {
      return res.status(403).json({
        message: "Apenas administradores podem comparar universidades."
      });
    }

    const comparison = await LogsUniversitiesComparisonService(
      universityId1,
      universityId2
    );

    return res.status(200).json(comparison);
  } catch (error) {
    console.error("[LogsUniversitiesComparisonController] Erro:", error);
    return res.status(500).json({
      message: "Erro ao comparar universidades."
    });
  }
}