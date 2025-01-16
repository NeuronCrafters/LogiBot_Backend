import { Request, Response } from "express";
import { sendResetPasswordEmailService } from "../../services/password/sendResetPasswordEmailService";

class SendResetPasswordEmailController {
  async handle(req: Request, res: Response) {
    const { senderEmail, senderPassword, recipientEmail, model } = req.body;

    try {
      if (!["User", "Professor"].includes(model)) {
        throw new Error("Modelo inválido. Use 'User' ou 'Professor'.");
      }

      await sendResetPasswordEmailService(
        senderEmail,
        senderPassword,
        recipientEmail,
        model as "User" | "Professor"
      );
      return res.status(200).json({ message: "E-mail de redefinição enviado com sucesso." });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

export { SendResetPasswordEmailController };
