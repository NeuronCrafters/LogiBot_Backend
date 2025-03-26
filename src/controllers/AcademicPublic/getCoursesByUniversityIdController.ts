import { Request, Response } from "express";
import { getCoursesByUniversityIdService } from "../../services/AcademicPublic/getCoursesByUniversityIdService";

export async function getCoursesByUniversityIdController(req: Request, res: Response) {
  const { universityId } = req.params;

  try {
    const data = await getCoursesByUniversityIdService(universityId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar cursos", error });
  }
}
