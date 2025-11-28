import { Request, Response } from "express";
import { UpdateProfessorRoleService } from "../../../services/admin/admin/UpdateProfessorRoleService";
import { AppError } from "../../../exceptions/AppError";

class UpdateProfessorRoleController {
  async handle(req: Request, res: Response) {
    const { id } = req.params;
    const { action } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!["add", "remove"].includes(action)) {
      throw new AppError("ação inválida. use 'add' ou 'remove'.", 400);
    }

    if (!userId || !userRole.includes("admin")) {
      throw new AppError("acesso negado. apenas administradores podem alterar o cargo.", 403);
    }

    if (userId === id) {
      throw new AppError("você não pode alterar seu próprio cargo.", 403);
    }

    const service = new UpdateProfessorRoleService();
    const updatedProfessor = await service.execute(id, action as "add" | "remove");

    return res.status(200).json(updatedProfessor);
  }
}

export { UpdateProfessorRoleController };
