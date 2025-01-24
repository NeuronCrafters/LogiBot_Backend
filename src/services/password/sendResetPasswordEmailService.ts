import { createTransporter } from "../../config/resetPassword/nodemailerTransport";
import { mailOptions } from "../../config/resetPassword/mailOptions";
import { GenerateResetToken } from "../../config/resetPassword/generateResetToken";

class SendResetPasswordEmailService {
  async sendEmail(email: string) {
    const generateResetTokenService = new GenerateResetToken();
    const { resetLink } = await generateResetTokenService.execute(email);

    const senderEmail = process.env.SMTP_EMAIL!;
    const senderPassword = process.env.SMTP_PASSWORD!;
    const domain = process.env.SMTP_DOMAIN!;
    const port = Number(process.env.SMTP_PORT!) || 587;

    const transporter = createTransporter(senderEmail, senderPassword, domain, port);

    const options = mailOptions(
      senderEmail,
      email,
      "Redefinição de Senha",
      `Olá,\n\nAcesse o seguinte link para redefinir sua senha:\n\n${resetLink}\n\nSe você não solicitou essa redefinição, ignore este e-mail.`
    );

    await transporter.sendMail(options);

    return { resetLink };
  }
}

export { SendResetPasswordEmailService };
