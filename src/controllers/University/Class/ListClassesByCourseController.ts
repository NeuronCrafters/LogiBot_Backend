import { Request, Response } from "express";
import { ListClassesByCourseService } from "../../../services/University/Class/ListClassesByCourseService";

class ListClassesByCourseController {
  async handle(req: Request, res: Response) {
    try {
      const { courseId } = req.params;
      const listClassesByCourseService = new ListClassesByCourseService();

      const classes = await listClassesByCourseService.listClassByCouse(courseId);
      return res.status(200).json(classes);
    } catch (error: any) {

      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }
}

export { ListClassesByCourseController };
