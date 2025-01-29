import { Request, Response } from "express";
import { ListProfessorsByCourseService } from "../../services/admin/listProfessorsByCourseService";

class ListProfessorsByCourseController {
  async handle(req: Request, res: Response) {
    const { courseId } = req.params;

    const listProfessorsByCourseService = new ListProfessorsByCourseService();
    const professors = await listProfessorsByCourseService.execute(courseId);

    return res.status(200).json(professors);
  }
}

export { ListProfessorsByCourseController };
