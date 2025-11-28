import { Request, Response } from "express";
import { CreateCourseService } from "../../../services/University/Course/CreateCourseService";

class CreateCourseController {
  async handle(req: Request, res: Response) {
    try {
      const { name, universityId } = req.body;

      if (!name || !universityId) {
        return res.status(400).json({ message: "Nome e ID da universidade são obrigatórios!" });
      }

      const createCourseService = new CreateCourseService();
      const course = await createCourseService.execute(name, universityId);

      return res.status(201).json(course);
    } catch (error: any) {

      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }
}

export { CreateCourseController };
