import { Request, Response } from "express";
import { UpdatePasswordService } from "../../services/password/updatePasswordService";

class UpdatePasswordController {
  async handle(req: Request, res: Response): Promise<Response> {
    const { currentPassword, newPassword } = req.body;

    try {
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: "Os campos 'currentPassword' e 'newPassword' são obrigatórios.",
        });
      }

      const userId = req.user?.id;
      const roles = req.user?.role;

      if (!userId || !roles || !Array.isArray(roles)) {
        return res.status(401).json({
          error: "Usuário não autenticado corretamente.",
        });
      }

      const allowedRoles = ["professor", "student", "admin"] as const;
      const role = roles.find((r: string) =>
          allowedRoles.includes(r as typeof allowedRoles[number])
      ) as typeof allowedRoles[number] | undefined;

      if (!role) {
        return res.status(403).json({ error: "Papel de usuário inválido." });
      }

      const service = new UpdatePasswordService();

      await service.updatePassword(userId, currentPassword, newPassword, role);

      return res.status(200).json({ message: "Senha atualizada com sucesso." });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || "Erro ao atualizar a senha." });
    }
  }
}

export { UpdatePasswordController };
