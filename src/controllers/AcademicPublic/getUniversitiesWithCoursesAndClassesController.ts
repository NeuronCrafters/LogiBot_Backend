import { Request, Response } from "express";
import { getUniversitiesWithCoursesAndClassesService } from "../../services/AcademicPublic/getUniversitiesWithCoursesAndClassesService";

export async function getUniversitiesWithCoursesAndClassesController(req: Request, res: Response) {
  try {
    const data = await getUniversitiesWithCoursesAndClassesService();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar instituições acadêmicas", error });
  }
}
