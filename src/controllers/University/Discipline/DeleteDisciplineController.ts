import { Request, Response } from "express";
import { DeleteDisciplineService } from "../../../services/University/Discipline/DeleteDisciplineService";

class DeleteDisciplineController {
  async handle(req: Request, res: Response) {
    try {
      const { disciplineId } = req.params;

      if (!disciplineId) {
        return res.status(400).json({ message: "ID da disciplina é obrigatório!" });
      }

      const deleteDisciplineService = new DeleteDisciplineService();
      const result = await deleteDisciplineService.execute(disciplineId);

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }
}

export { DeleteDisciplineController };
