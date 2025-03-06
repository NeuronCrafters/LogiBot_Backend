import { Request, Response } from "express";
import { DeleteClassService } from "../../../services/University/Class/DeleteClassService";

class DeleteClassController {
  async handle(req: Request, res: Response) {
    try {
      const { classId } = req.params;
      const deleteClassService = new DeleteClassService();

      const result = await deleteClassService.deleteClass(classId);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("Erro ao remover turma:", error.message);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }
}

export { DeleteClassController };
