import { Request, Response } from "express";
import { getClassesByCourseIdService } from "../../services/AcademicPublic/getClassesByCourseIdService";

export async function getClassesByCourseIdController(req: Request, res: Response) {
  const { universityId, courseId } = req.params;

  try {
    const data = await getClassesByCourseIdService(universityId, courseId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar turmas", error });
  }
}
