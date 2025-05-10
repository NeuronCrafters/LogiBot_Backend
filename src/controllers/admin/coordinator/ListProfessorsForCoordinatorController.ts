import { Request, Response } from "express";
import { ListProfessorsForCoordinatorService } from "../../../services/admin/coordinator/ListProfessorsForCoordinatorService";
import { Professor } from "../../../models/Professor";

async function ListProfessorsForCoordinatorController(
  req: Request,
  res: Response
) {
  const authUser = req.user as { id: string; role: string[]; school: string };

  if (!authUser.role.includes("course-coordinator")) {
    return res.status(403).json({ message: "Acesso negado." });
  }

  const prof = await Professor.findById(authUser.id).select("courses").lean();
  if (!prof) {
    return res.status(404).json({ message: "Professor não encontrado." });
  }

  const courses = (prof.courses || []).map((c) => c.toString());
  if (courses.length === 0) {
    return res
      .status(400)
      .json({ message: "Coordenador não está associado a nenhum curso." });
  }
  const courseId = courses[0];

  const professors = await ListProfessorsForCoordinatorService(
    authUser.school,
    courseId
  );
  return res.json(professors);
}

export { ListProfessorsForCoordinatorController }