import { Request, Response } from "express";
import { AssignDisciplineService } from "../../../services/University/UniversityOuthers/AssignDisciplineService";

class AssignDisciplineController {
  async handle(req: Request, res: Response): Promise<Response> {
    try {
      const { studentId, disciplineId } = req.body;

      if (!studentId || !disciplineId) {
        return res.status(400).json({
          message: "Os campos studentId e disciplineId são obrigatórios.",
        });
      }

      const assignDisciplineService = new AssignDisciplineService();
      const result = await assignDisciplineService.assignDiscipline(
        studentId,
        disciplineId
      );

      return res.status(200).json(result);
    } catch (error: any) {
      console.error("Erro no AssignDisciplineController:", error.message);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }
}

export { AssignDisciplineController };
