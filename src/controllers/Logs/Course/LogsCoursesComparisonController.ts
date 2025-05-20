// controllers/Logs/Comparison/LogsCoursesComparisonController.ts

import { Request, Response } from "express";
import { LogsCoursesComparisonService } from "../../../services/Logs/Course/LogsCoursesComparisonService";
import { Professor } from "../../../models/Professor";
import { Types } from "mongoose";

export async function LogsCoursesComparisonController(req: Request, res: Response) {
  try {
    const { courseId1, courseId2 } = req.body;
    const userId = req.user.id;
    const userRole: string[] = req.user.role;

    if (!courseId1 || !courseId2) {
      return res.status(400).json({
        message: "Os IDs dos dois cursos são obrigatórios."
      });
    }

    // Se o usuário é admin, tem acesso direto
    if (userRole.includes("admin")) {
      const comparison = await LogsCoursesComparisonService(courseId1, courseId2);
      return res.status(200).json(comparison);
    }

    // Se não for admin, verifica se é coordenador com acesso aos cursos
    const professor = await Professor.findOne({ userId });
    if (!professor) {
      return res.status(403).json({ message: "Professor não encontrado." });
    }

    const isCoordinator = professor.role.includes("course-coordinator");

    if (!isCoordinator) {
      return res.status(403).json({
        message: "Apenas coordenadores podem comparar cursos."
      });
    }

    // Verifica se tem acesso aos dois cursos
    const courseObjectId1 = new Types.ObjectId(courseId1);
    const courseObjectId2 = new Types.ObjectId(courseId2);

    const hasAccessToCourse1 = professor.courses.some(c => c.equals(courseObjectId1));
    const hasAccessToCourse2 = professor.courses.some(c => c.equals(courseObjectId2));

    if (!hasAccessToCourse1 || !hasAccessToCourse2) {
      return res.status(403).json({
        message: "Acesso negado. Coordenador não tem acesso a um ou ambos os cursos."
      });
    }

    const comparison = await LogsCoursesComparisonService(courseId1, courseId2);
    return res.status(200).json(comparison);
  } catch (error) {
    console.error("[LogsCoursesComparisonController] Erro:", error);
    return res.status(500).json({
      message: "Erro ao comparar cursos."
    });
  }
}