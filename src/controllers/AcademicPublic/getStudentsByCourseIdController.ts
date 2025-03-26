import { Request, Response } from "express";
import { getStudentsByCourseIdService } from "../../services/AcademicPublic/getStudentsByCourseIdService";

export async function getStudentsByCourseIdController(req: Request, res: Response) {
  const { universityId, courseId } = req.params;

  try {
    const data = await getStudentsByCourseIdService(universityId, courseId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar alunos do curso", error });
  }
}
