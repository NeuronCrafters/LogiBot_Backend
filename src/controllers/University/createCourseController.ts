import { Request, Response } from "express";
import { createCourseService } from "../../services/University/createCourseService";

class createCourseController {
  async handle(req: Request, res: Response) {
    try {
      const { name, universityId } = req.body;

      if (!name || !universityId) {
        return res.status(400).json({ message: "Nome e ID da universidade são obrigatórios!" });
      }

      const courseService = new createCourseService();
      const course = await courseService.create(name, universityId);

      return res.status(201).json(course);
    } catch (error: any) {
      console.error("Erro ao criar curso:", error.message);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const { universityId } = req.params;

      if (!universityId) {
        return res.status(400).json({ message: "ID da universidade é obrigatório!" });
      }

      const courseService = new createCourseService();
      const courses = await courseService.listByUniversity(universityId);

      return res.status(200).json(courses);
    } catch (error: any) {
      console.error("Erro ao listar cursos:", error.message);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { courseId } = req.params;

      if (!courseId) {
        return res.status(400).json({ message: "ID do curso é obrigatório!" });
      }

      const courseService = new createCourseService();
      const result = await courseService.delete(courseId);

      return res.status(200).json(result);
    } catch (error: any) {
      console.error("Erro ao remover curso:", error.message);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }
}

export { createCourseController };
