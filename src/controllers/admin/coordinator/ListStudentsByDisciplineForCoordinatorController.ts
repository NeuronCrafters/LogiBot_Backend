import { Request, Response } from "express";
import { ListStudentsByDisciplineForCoordinatorService } from "../../../services/admin/coordinator/ListStudentsByDisciplineForCoordinatorService";

/**
 * GET /admin/coordinator/students/discipline/:disciplineId
 * Apenas usuários com role "course-coordinator" podem acessar.
 */
export async function ListStudentsByDisciplineForCoordinatorController(
  req: Request,
  res: Response
) {
  const user = req.user as { role: string[]; school: string; course: string };
  const { disciplineId } = req.params;

  if (!user.role.includes("course-coordinator")) {
    return res.status(403).json({ message: "Acesso negado." });
  }

  const students = await ListStudentsByDisciplineForCoordinatorService(
    user.school,
    user.course,
    disciplineId
  );
  return res.json(students);
}
