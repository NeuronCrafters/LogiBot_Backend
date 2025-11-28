import { Request, Response } from "express";
import { DeleteCourseService } from "../../../services/University/Course/DeleteCourseService";

class DeleteCourseController {
  async handle(req: Request, res: Response) {
    try {
      const { courseId } = req.params;

      if (!courseId) {
        return res.status(400).json({ message: "ID do curso é obrigatório!" });
      }

      const deleteCourseService = new DeleteCourseService();
      const result = await deleteCourseService.execute(courseId);

      return res.status(200).json(result);
    } catch (error: any) {
      console.error("erro ao remover curso:", error.message);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }
}

export { DeleteCourseController };
