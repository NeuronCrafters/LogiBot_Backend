import { createTransporter } from "../../config/resetPassword/nodemailerTransport";
import { mailOptions } from "../../config/resetPassword/mailOptions";
import { generateResetToken } from "./generateResetTokenService";

export const sendResetPasswordEmailService = async (
  senderEmail: string,
  senderPassword: string,
  recipientEmail: string,
  model: "User" | "Professor"
) => {

  const { token, resetLink } = await generateResetToken(recipientEmail, model);

  const domain = senderEmail.split("@")[1];
  const transporter = createTransporter(senderEmail, senderPassword, domain);

  const options = mailOptions(senderEmail, recipientEmail, "Redefinição de Senha", resetLink);
  await transporter.sendMail(options);

  return token;
};
