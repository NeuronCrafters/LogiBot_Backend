import { Request, Response } from "express";
import { getDisciplinesByCourseIdService } from "../../services/AcademicPublic/getDisciplinesByCourseIdService";

export async function getDisciplinesByCourseIdController(req: Request, res: Response) {
  const { universityId, courseId } = req.params;

  try {
    const data = await getDisciplinesByCourseIdService(universityId, courseId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar disciplinas", error });
  }
}
