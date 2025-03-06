import { Request, Response } from "express";
import { DeleteProfessorService } from "../../services/admin/deleteProfessorService";

class DeleteProfessorController {
  async handle(req: Request, res: Response) {
    const { professorId } = req.params;

    const deleteProfessorService = new DeleteProfessorService();
    const result = await deleteProfessorService.execute(professorId);

    return res.status(200).json(result);
  }
}

export { DeleteProfessorController };
