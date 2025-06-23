import { Request, Response } from "express";
import { SendResetPasswordEmailService } from "../../services/password/sendResetPasswordEmailService";

class SendResetPasswordEmailController {
  async handle(req: Request, res: Response): Promise<Response> {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "O campo 'email' é obrigatório." });
    }

    try {
      const service = new SendResetPasswordEmailService();
      const { resetLink } = await service.sendEmail(email);

      return res.status(200).json({
        message: "E-mail de redefinição enviado com sucesso.",
        ...(process.env.NODE_ENV !== "production" && { resetLink }) // só expõe link fora de prod
      });
    } catch (error: unknown) {
      const errMsg =
          error instanceof Error ? error.message : "Erro ao enviar e-mail de redefinição.";
      const status = errMsg === "Usuário não encontrado." ? 404 : 400;
      return res.status(status).json({ error: errMsg });
    }
  }
}

export { SendResetPasswordEmailController };
