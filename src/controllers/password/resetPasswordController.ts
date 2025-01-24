import { Request, Response } from "express";
import { ResetPasswordService } from "../../services/password/resetPasswordService";

class ResetPasswordController {
  async handle(req: Request, res: Response): Promise<Response> {
    const { token, newPassword } = req.body;

    try {
      const service = new ResetPasswordService();
      await service.resetPassword(token, newPassword);

      return res.status(200).json({ message: "Senha redefinida com sucesso." });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

export { ResetPasswordController };
