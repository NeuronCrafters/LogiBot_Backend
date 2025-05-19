import { Request, Response } from "express";
import { LogsCourseSummaryService } from "../../../services/Logs/Course/LogsCourseSummaryService";
import { Professor } from "../../../models/Professor";
import { Types } from "mongoose";

export async function LogsCourseSummaryController(req: Request, res: Response) {
  try {
    const { courseId } = req.params;
    const userRole: string[] = req.user.role;
    const userId = req.user.id;

    if (!courseId) {
      return res.status(400).json({ message: "O ID do curso é obrigatório." });
    }

    if (userRole.includes("admin")) {
      const summary = await LogsCourseSummaryService(courseId);
      return res.status(200).json(summary);
    }

    const professor = await Professor.findOne({ userId });
    if (!professor) {
      return res.status(403).json({ message: "Professor não encontrado." });
    }

    const isCoordinator = professor.role.includes("course-coordinator");
    const courseObjectId = new Types.ObjectId(courseId);

    if (isCoordinator && professor.courses.some((c) => c.equals(courseObjectId))) {
      const summary = await LogsCourseSummaryService(courseId);
      return res.status(200).json(summary);
    }

    return res.status(403).json({ message: "Acesso negado. Apenas coordenadores do curso têm permissão." });
  } catch (error) {
    console.error("[LogsCourseSummaryController] Erro:", error);
    return res.status(500).json({ message: "Erro ao obter dados do curso." });
  }
}
