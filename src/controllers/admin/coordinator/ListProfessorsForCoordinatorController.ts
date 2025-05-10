import { Request, Response } from "express";
import { ListProfessorsForCoordinatorService } from "../../../services/admin/coordinator/ListProfessorsForCoordinatorService";

/**
 * GET /admin/coordinator/professors
 * Apenas usuários com role "course-coordinator" podem acessar.
 */
export async function ListProfessorsForCoordinatorController(
  req: Request,
  res: Response
) {
  const user = req.user as { role: string[]; school: string; course: string };

  if (!user.role.includes("course-coordinator")) {
    return res.status(403).json({ message: "Acesso negado." });
  }

  const professors = await ListProfessorsForCoordinatorService(
    user.school,
    user.course
  );
  return res.json(professors);
}
