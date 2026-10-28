import nodemailer from "nodemailer";
import { sendPasswordResetEmail } from "../services/email/mailService";

jest.mock("nodemailer", () => ({ __esModule: true, default: { createTransport: jest.fn() } }));
const sendMail = jest.fn().mockResolvedValue({});

describe('emails localizados', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    process.env.SMTP_HOST='mail.test'; process.env.SMTP_USER='test'; process.env.SMTP_PASS='test';
    (nodemailer.createTransport as jest.Mock).mockReturnValue({sendMail});
    sendMail.mockClear();
  });
  afterEach(() => { process.env={...originalEnv}; });

  it('preserva os textos originais em português e mantém o link técnico', async () => {
    await sendPasswordResetEmail({to:'test@example.invalid',name:'Maria',resetLink:'https://example.invalid/reset-password?token=abc'});
    const mail=sendMail.mock.calls[0][0];
    expect(mail.subject).toBe('Redefinicao de senha - LogiBot');
    expect(mail.text).toBe('Ola, Maria.\n\nRecebemos uma solicitacao para redefinir sua senha no LogiBot.\n\nAcesse o link para criar uma nova senha: https://example.invalid/reset-password?token=abc\n\nSe voce nao solicitou isso, ignore este email.');
    expect(mail.html).toContain('Redefinir senha');
    expect(mail.html).toContain('href="https://example.invalid/reset-password?token=abc"');
  });

  it('envia versões independentes em inglês e espanhol sem alterar nome/link', async () => {
    await Promise.all((['en-US','es-ES'] as const).map(language => sendPasswordResetEmail({to:'test@example.invalid',name:'João',resetLink:'https://example.invalid/reset?token=abc',language})));
    const mails=sendMail.mock.calls.map(call=>call[0]);
    expect(mails.map(mail=>mail.subject)).toEqual(expect.arrayContaining(['Password reset - LogiBot','Restablecimiento de contraseña - LogiBot']));
    for(const mail of mails) {
      expect(mail.text).toContain('João');
      expect(mail.html).toContain('https://example.invalid/reset?token=abc');
    }
  });
});
