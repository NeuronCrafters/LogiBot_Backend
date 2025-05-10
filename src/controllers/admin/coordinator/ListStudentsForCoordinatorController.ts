import { Request, Response } from "express";
import { ListStudentsForCoordinatorService } from "../../../services/admin/coordinator/ListStudentsForCoordinatorService";

/**
 * GET /admin/coordinator/students
 * Apenas usuários com role "course-coordinator" podem acessar.
 */
export async function ListStudentsForCoordinatorController(
  req: Request,
  res: Response
) {
  const user = req.user as { role: string[]; school: string; course: string };

  if (!user.role.includes("course-coordinator")) {
    return res.status(403).json({ message: "Acesso negado." });
  }

  const students = await ListStudentsForCoordinatorService(
    user.school,
    user.course
  );
  return res.json(students);
}
