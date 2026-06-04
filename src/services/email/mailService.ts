import nodemailer from "nodemailer";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function boolEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes"].includes(value.toLowerCase());
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP nao configurado. Defina SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS.",
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: boolEnv(process.env.SMTP_SECURE, port === 465),
    auth: { user, pass },
  });
}

export async function sendMail(input: MailInput) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  if (!from)
    throw new Error("MAIL_FROM ou SMTP_USER precisa estar configurado.");

  const transporter = getTransporter();
  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetLink: string;
}) {
  await sendMail({
    to: input.to,
    subject: "Redefinicao de senha - LogiBot",
    text: [
      `Ola, ${input.name}.`,
      "Recebemos uma solicitacao para redefinir sua senha no LogiBot.",
      `Acesse o link para criar uma nova senha: ${input.resetLink}`,
      "Se voce nao solicitou isso, ignore este email.",
    ].join("\n\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2>Redefinicao de senha</h2>
        <p>Ola, ${input.name}.</p>
        <p>Recebemos uma solicitacao para redefinir sua senha no LogiBot.</p>
        <p>
          <a href="${input.resetLink}" style="display: inline-block; padding: 10px 16px; background: #ea580c; color: #ffffff; text-decoration: none; border-radius: 6px;">
            Redefinir senha
          </a>
        </p>
        <p>Se voce nao solicitou isso, ignore este email.</p>
      </div>
    `,
  });
}
