import { Request, Response } from "express";
import { CreateProfessorService } from "../../services/admin/CreateProfessorService";

class CreateProfessorController {
  async handle(req: Request, res: Response) {
    const { name, email, password, courses, school } = req.body;

    const createProfessorService = new CreateProfessorService();
    const professor = await createProfessorService.execute({ name, email, password, courses, school });

    return res.status(201).json(professor);
  }
}

export { CreateProfessorController };
