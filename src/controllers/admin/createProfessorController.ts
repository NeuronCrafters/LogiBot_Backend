import { Request, Response } from "express";
import { createProfessorService } from "../../services/admin/createProfessorService";

class CreateProfessorController {
  async handle(req: Request, res: Response) {
    const { name, email, password, courses, school } = req.body;

    const createProfessorServices = new createProfessorService();

    const professor = await createProfessorServices.create({ name, email, password, courses, school });

    return res.status(201).json(professor);
  }

  async listByCourse(req: Request, res: Response) {
    const { courseId } = req.params;

    const professorService = new createProfessorService();
    const professors = await professorService.listByCourse(courseId);

    return res.status(200).json(professors);
  }

  async delete(req: Request, res: Response) {
    const { professorId } = req.params;

    const professorService = new createProfessorService();
    const result = await professorService.delete(professorId);

    return res.status(200).json(result);
  }
}

export { CreateProfessorController };
