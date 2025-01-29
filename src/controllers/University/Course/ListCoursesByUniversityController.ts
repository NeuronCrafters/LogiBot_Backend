import { Request, Response } from "express";
import { ListCoursesByUniversityService } from "../../../services/University/Course/ListCoursesByUniversityService";

class ListCoursesByUniversityController {
  async handle(req: Request, res: Response) {
    try {
      const { universityId } = req.params;

      if (!universityId) {
        return res.status(400).json({ message: "ID da universidade é obrigatório!" });
      }

      const listCoursesByUniversityService = new ListCoursesByUniversityService();
      const courses = await listCoursesByUniversityService.execute(universityId);

      return res.status(200).json(courses);
    } catch (error: any) {
      console.error("Erro ao listar cursos:", error.message);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }
}

export { ListCoursesByUniversityController };
