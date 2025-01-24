import { Request, Response } from "express";
import { SendResetPasswordEmailService } from "../../services/password/sendResetPasswordEmailService";

class SendResetPasswordEmailController {
  async handle(req: Request, res: Response): Promise<Response> {
    const { email } = req.body;

    try {
      if (!email) {
        throw new Error("O campo 'email' é obrigatório.");
      }

      const service = new SendResetPasswordEmailService();
      const { resetLink } = await service.sendEmail(email);

      return res.status(200).json({
        message: "E-mail de redefinição enviado com sucesso.",
        resetLink,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

export { SendResetPasswordEmailController };
