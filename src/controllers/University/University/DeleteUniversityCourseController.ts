import { Request, Response } from "express";
import { DeleteUniversityCourseService } from "../../../services/University/University/DeleteUniversityCourseService";

class DeleteUniversityCourseController {
  async handle(req: Request, res: Response) {
    try {
      const { courseId } = req.params;

      if (!courseId) {
        return res.status(400).json({ message: "ID do curso é obrigatório!" });
      }

      const deleteUniversityCourseService = new DeleteUniversityCourseService();
      const result = await deleteUniversityCourseService.execute(courseId);

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }
}

export { DeleteUniversityCourseController };
