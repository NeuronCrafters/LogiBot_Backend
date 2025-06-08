import { Request, Response } from "express";
import { LogsCourseSummaryService } from "../../../services/Logs/Course/LogsCourseSummaryService";
import { Professor } from "../../../models/Professor";
import { isAdmin, isCourseCoordinator } from "../../../utils/RoleChecker";

export async function LogsCourseSummaryController(req: Request, res: Response) {
  try {
    const { courseId } = req.params;
    const userRole: string[] = req.user.role;
    const userId = req.user.id;

    console.log("Requisição para resumo de curso:", courseId);

    if (!courseId) {
      return res.status(400).json({ message: "O ID do curso é obrigatório." });
    }

    if (isAdmin(userRole)) {
      const summary = await LogsCourseSummaryService(courseId);
      return res.status(200).json(summary);
    }

    if (isCourseCoordinator(userRole)) {
      const professor = await Professor.findById(userId);
      if (!professor) return res.status(403).json({ message: "Professor não encontrado." });

      if (professor.courses.some((c) => c.toString() === courseId)) {
        const summary = await LogsCourseSummaryService(courseId);
        return res.status(200).json(summary);
      }
    }

    return res.status(403).json({ message: "Acesso negado." });
  } catch (error) {
    console.error("[LogsCourseSummaryController] Erro:", error);
    return res.status(500).json({ message: "Erro ao obter dados do curso." });
  }
}
