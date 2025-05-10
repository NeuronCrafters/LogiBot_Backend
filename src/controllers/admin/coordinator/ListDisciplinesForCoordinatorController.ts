import { Request, Response } from "express";
import { ListDisciplinesForCoordinatorService } from "../../../services/admin/coordinator/ListDisciplinesForCoordinatorService";
import { Professor } from "../../../models/Professor";

export async function ListDisciplinesForCoordinatorController(
  req: Request,
  res: Response
) {
  const authUser = req.user as { id: string; role: string[]; school: string };

  if (!authUser.role.includes("course-coordinator")) {
    return res.status(403).json({ message: "Acesso negado." });
  }

  const prof = await Professor.findById(authUser.id).select("courses").lean();
  if (!prof) {
    return res.status(404).json({ message: "Coordenador não encontrado." });
  }

  const courses = (prof.courses || []).map(String);
  if (courses.length === 0) {
    return res
      .status(400)
      .json({ message: "Coordenador não está associado a nenhum curso." });
  }
  const courseId = courses[0];

  const disciplines = await ListDisciplinesForCoordinatorService(
    authUser.school,
    courseId
  );
  return res.json(disciplines);
}
