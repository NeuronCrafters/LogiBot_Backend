import { Request, Response } from "express";
import { ListClassesForCoordinatorService } from "../../../services/admin/coordinator/ListClassesForCoordinatorService";
import { Professor } from "../../../models/Professor";

export async function ListClassesForCoordinatorController(
  req: Request,
  res: Response
) {
  const authUser = req.user as { id: string; role: string[]; school: string };

  if (!authUser.role.includes("course-coordinator")) {
    return res.status(403).json({ message: "Acesso negado." });
  }

  const prof = await Professor.findById(authUser.id)
    .select("courses")
    .lean();
  if (!prof) {
    return res.status(404).json({ message: "Coordenador não encontrado." });
  }

  const courseId = (prof.courses || []).map(String)[0];
  if (!courseId) {
    return res
      .status(400)
      .json({ message: "Você não está associado a nenhum curso." });
  }

  try {
    const classes = await ListClassesForCoordinatorService(
      authUser.school,
      courseId
    );
    return res.json(classes);
  } catch (err: any) {
    if (err.message.includes("não pertence")) {
      return res.status(403).json({ message: err.message });
    }
    return res.status(500).json({ message: "Erro interno." });
  }
}
