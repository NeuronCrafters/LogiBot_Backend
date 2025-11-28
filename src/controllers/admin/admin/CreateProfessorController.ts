import { Request, Response } from "express";
import { CreateProfessorService } from "../../../services/admin/admin/CreateProfessorService";

class CreateProfessorController {
  async handle(req: Request, res: Response) {
    const { name, email, password, school, courses } = req.body;

    const createProfessorService = new CreateProfessorService();

    try {
      const professor = await createProfessorService.execute({
        name,
        email,
        password,
        school,
        courses,
      });

      return res.status(201).json(professor);
    } catch (error) {

      return res.status(error.statusCode || 500).json({
        error: error.message || "Erro interno ao criar professor",
      });
    }
  }
}

export { CreateProfessorController };
