import { Request, Response } from "express";
import { ListStudentsService } from "../../../services/admin/professor/ListStudentsService";
import { AppError } from "../../../exceptions/AppError";

class ListStudentsController {
  async handle(req: Request, res: Response) {
    try {
      const requesterId = String(req.user?.id);
      const requesterRole = req.user?.role;

      if (!requesterId || !requesterRole) {
        throw new AppError("Usuário não autenticado ou sem papel definido.", 401);
      }

      const service = new ListStudentsService();

      const students = await service.execute({
        requesterId,
        requesterRole,
      });

      return res.status(200).json(students);
    } catch (error) {
      console.error("Erro no controller de listagem de alunos:", error);

      const status = error instanceof AppError ? error.statusCode : 500;
      const message = error instanceof AppError ? error.message : "Erro interno ao listar alunos.";

      return res.status(status).json({ error: message });
    }
  }
}

export { ListStudentsController };
