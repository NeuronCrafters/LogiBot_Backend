import { Request, Response } from "express";
import { createProfessorService } from "../../services/University/createProfessorService";

class CreateProfessorController {
  async handle(req: Request, res: Response) {
    const { name, email, password, courses, school } = req.body;

    const createProfessorServices = new createProfessorService();

    const professor = await createProfessorServices.create({ name, email, password, courses, school });

    return res.status(201).json(professor);
  }
}

export { CreateProfessorController };
