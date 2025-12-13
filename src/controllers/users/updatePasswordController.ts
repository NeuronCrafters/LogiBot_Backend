import { Request, Response } from "express";
import { UpdatePasswordService } from "../../services/users/updatePasswordService";

class UpdatePasswordController {
  async handle(req: Request, res: Response): Promise<Response> {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || !role) {
      return res.status(401).json({
        error: "Usuário não autenticado.",
      });
    }

    const service = new UpdatePasswordService();

    try {
      await service.execute({
        userId,
        role,
        currentPassword,
        newPassword
      });

      return res.status(200).json({ message: "Senha atualizada com sucesso." });
    } catch (error: any) {
      return res.status(error.statusCode || 400).json({
        error: error.message || "Erro ao atualizar a senha.",
      });
    }
  }
}

export { UpdatePasswordController };