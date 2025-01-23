import { createTransporter } from "../../config/resetPassword/nodemailerTransport";
import { mailOptions } from "../../config/resetPassword/mailOptions";
import { GenerateResetToken } from "../../config/resetPassword/generateResetToken";

class SendResetPasswordEmailService {
  async sendEmail(email: string, model: "User" | "Professor") {
    const generateResetTokenService = new GenerateResetToken();
    const { resetLink } = await generateResetTokenService.execute(email, model);

    const senderEmail = process.env.SMTP_EMAIL!;
    const senderPassword = process.env.SMTP_PASSWORD!;
    const host = process.env.SMTP_HOST!;
    const port = Number(process.env.SMTP_PORT!);

    const transporter = createTransporter(senderEmail, senderPassword, host, port);

    const options = mailOptions(
      senderEmail,
      email,
      "Redefinição de Senha",
      `Olá,\n\nAcesse o link abaixo para redefinir sua senha:\n\n${resetLink}\n\nSe você não solicitou essa redefinição, ignore este e-mail.`
    );

    await transporter.sendMail(options);

    return { resetLink };
  }
}

export { SendResetPasswordEmailService };
