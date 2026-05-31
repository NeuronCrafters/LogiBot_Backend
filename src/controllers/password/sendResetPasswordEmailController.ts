import { Request, Response } from "express";
import { SendResetPasswordEmailService } from "../../services/password/sendResetPasswordEmailService";

class SendResetPasswordEmailController {
  async handle(req: Request, res: Response): Promise<Response> {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "O campo 'email' é obrigatório." });
    }

    const service = new SendResetPasswordEmailService();
    await service.sendEmail(email);
    return res.status(410).json({
      error: "Recuperação de senha por e-mail foi removida. Contate o administrador.",
    });
  }
}

export { SendResetPasswordEmailController };
