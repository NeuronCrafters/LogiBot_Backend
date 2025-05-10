import { Request, Response } from "express";
import { ListStudentsForCoordinatorService } from "../../../services/admin/coordinator/ListStudentsForCoordinatorService";
import { Professor } from "../../../models/Professor";

async function ListStudentsForCoordinatorController(
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

  const students = await ListStudentsForCoordinatorService(
    authUser.school,
    courseId
  );
  return res.json(students);
}

export { ListStudentsForCoordinatorController }