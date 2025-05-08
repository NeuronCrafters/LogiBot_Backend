import { Request, Response } from "express";
import { UpdateProfessorRoleService } from "../../../services/admin/crud/UpdateProfessorRoleService";
import { AppError } from "../../../exceptions/AppError";

class UpdateProfessorRoleController {
  async handle(req: Request, res: Response) {
    const { id } = req.params;
    const { action } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!["add", "remove"].includes(action)) {
      throw new AppError("Ação inválida. Use 'add' ou 'remove'.", 400);
    }

    if (!userId || !userRole.includes("admin")) {
      throw new AppError("Acesso negado. Apenas administradores podem alterar o cargo.", 403);
    }

    if (userId === id) {
      throw new AppError("Você não pode alterar seu próprio cargo.", 403);
    }

    const service = new UpdateProfessorRoleService();
    const updatedProfessor = await service.execute(id, action as "add" | "remove");

    return res.status(200).json(updatedProfessor);
  }
}

export { UpdateProfessorRoleController };
