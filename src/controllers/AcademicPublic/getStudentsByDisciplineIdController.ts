import { Request, Response } from "express";
import { getStudentsByDisciplineIdService } from "../../services/AcademicPublic/getStudentsByDisciplineIdService";

export async function getStudentsByDisciplineIdController(req: Request, res: Response) {
  const { universityId, courseId, disciplineId } = req.params;

  try {
    const data = await getStudentsByDisciplineIdService(universityId, courseId, disciplineId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar alunos da disciplina", error });
  }
}
