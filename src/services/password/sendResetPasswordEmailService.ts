import { createTransporter } from "../../config/resetPassword/nodemailerTransport";
import { mailOptions } from "../../config/resetPassword/mailOptions";
import { GenerateResetToken } from "../../config/resetPassword/generateResetToken";

class SendResetPasswordEmailService {
  async sendEmail(email: string) {
    const cleanEmail = email.toLowerCase().trim();

    // 1) Gera token e link de redefinição
    const generateResetTokenService = new GenerateResetToken();
    const { token } = await generateResetTokenService.execute(cleanEmail);

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    // 2) Configurações do e-mail
    const senderEmail = process.env.SMTP_EMAIL!;
    const senderPassword = process.env.SMTP_PASSWORD!;
    const domain = process.env.SMTP_DOMAIN!;
    const port = Number(process.env.SMTP_PORT!) || 587;
    const transporter = createTransporter(senderEmail, senderPassword, domain, port);

    // 3) HTML e texto alternativo do e-mail
    const html = `
      <p>Olá,</p>
      <p>Clique no botão abaixo para redefinir sua senha. O link expira em 1 hora.</p>
      <p>
        <a href="${resetLink}" 
           style="background:#2563EB;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none"
        >Redefinir senha</a>
      </p>
      <p>Ou copie e cole este link no navegador:<br/>${resetLink}</p>
      <p style="font-size:12px;color:#777">
        Se você não solicitou essa redefinição, ignore este e-mail.
      </p>
    `;

    const text = `Olá,\n\nAcesse o link abaixo para redefinir sua senha:\n\n${resetLink}\n\nSe você não solicitou, ignore este e-mail.`;

    // 4) Envio
    const options = mailOptions(senderEmail, cleanEmail, "Redefinição de senha", html, text);
    await transporter.sendMail(options);

    return { resetLink };
  }
}

export { SendResetPasswordEmailService };
