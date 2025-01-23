import { Request, Response } from "express";
import { UpdatePasswordService } from "../../services/password/updatePasswordService";

class UpdatePasswordController {
  async handle(req: Request, res: Response): Promise<Response> {
    const { currentPassword, newPassword } = req.body;

    try {
      if (!currentPassword || !newPassword) {
        throw new Error("Os campos 'currentPassword' e 'newPassword' são obrigatórios.");
      }


      const userId = req.user?.id;
      const roles = req.user?.role;

      if (!userId || !roles) {
        throw new Error("Informações do usuário ausentes no token.");
      }

      const allowedRoles = ["professor", "student", "admin"] as const;
      const role = roles.find((r: string) => allowedRoles.includes(r as any));

      if (!role) {
        throw new Error("Papel inválido.");
      }


      const service = new UpdatePasswordService();
      await service.updatePassword(userId, currentPassword, newPassword, role as "professor" | "student" | "admin");


      return res.status(200).json({ message: "Senha atualizada com sucesso." });
    } catch (error) {

      return res.status(400).json({ error: error.message });
    }
  }
}

export { UpdatePasswordController };
