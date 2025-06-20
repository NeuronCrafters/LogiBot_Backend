import { Request, Response } from "express";
import { UpdatePasswordService } from "../../services/password/updatePasswordService";

class UpdatePasswordController {
  async handle(req: Request, res: Response): Promise<Response> {
    const { currentPassword, newPassword } = req.body;

    try {
      // Validação básica dos campos
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: "Os campos 'currentPassword' e 'newPassword' são obrigatórios.",
        });
      }

      // Verifica se o user veio pelo middleware de autenticação
      const userId = req.user?.id;
      const userRoles = req.user?.role;

      if (!userId || !userRoles || !Array.isArray(userRoles)) {
        return res.status(401).json({
          error: "Usuário não autenticado ou dados incompletos no token.",
        });
      }

      // Garante que o papel do usuário seja válido
      const allowedRoles = ["professor", "student", "admin"] as const;
      const role = userRoles.find((r: string): r is typeof allowedRoles[number] =>
          allowedRoles.includes(r as any)
      );

      if (!role) {
        return res.status(403).json({ error: "Papel de usuário inválido." });
      }

      // Executa o serviço
      const service = new UpdatePasswordService();
      await service.updatePassword(userId, currentPassword, newPassword, role);

      return res.status(200).json({ message: "Senha atualizada com sucesso." });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || "Erro ao atualizar a senha." });
    }
  }
}

export { UpdatePasswordController };
