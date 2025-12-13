import { Model } from 'mongoose';
import { User } from '../../models/User';
import { Professor } from '../../models/Professor';
import { createTransporter } from '../../config/resetPassword/nodemailerTransport';

interface FeedbackRequest {
  userId: string;
  userRoles: string[] | string;
  message: string;
  type: string;
}

class feedbackService {
  async execute({ userId, userRoles, message, type }: FeedbackRequest) {
    const rolesArray = Array.isArray(userRoles) ? userRoles : [userRoles];
    const isStudent = rolesArray.includes('student');
    const isVip = rolesArray.includes('course-coordinator') || rolesArray.includes('admin');

    const TargetModel = (isStudent ? User : Professor) as Model<any>;

    const user = await TargetModel.findById(userId);

    if (!user) {
      throw new Error('UserNotFound');
    }

    if (!isVip) {
      const lastFeedback = user.lastFeedbackAt;

      if (lastFeedback) {
        const now = new Date();
        const lastDate = new Date(lastFeedback);

        const diffTime = Math.abs(now.getTime() - lastDate.getTime());
        const diffMinutes = diffTime / (1000 * 60);

        if (diffMinutes < 2) {
          const minutesRemaining = Math.ceil(2 - diffMinutes);
          throw new Error(`RateLimit: aguarde ${minutesRemaining} minuto(s) para enviar novamente.`);
        }
      }
    }

    const userLabel = isStudent ? 'Aluno(a)' : isVip ? 'Coordenador(a)' : 'Professor(a)';
    const priorityTag = isVip ? '[PRIORIDADE]' : '';
    const subjectLine = `${priorityTag} [${type || 'GERAL'}] Feedback de ${user.name}`;
    const headerColor = isVip ? '#dc2626' : '#007bff';

    const senderEmail = process.env.SMTP_EMAIL as string;
    const senderPass = process.env.SMTP_PASSWORD as string;
    const senderDomain = process.env.SMTP_DOMAIN || 'gmail.com';
    const supportEmail = process.env.EMAIL_SUPPORT || senderEmail;

    const transporter = createTransporter(
      senderEmail,
      senderPass,
      senderDomain
    );

    const mailOptions = {
      from: `"Sistema de Feedback" <${senderEmail}>`,
      to: supportEmail,
      subject: subjectLine,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
          <h2 style="border-bottom: 2px solid ${headerColor}; padding-bottom: 10px;">
            ${isVip ? '⚠️ Relatório de Coordenação' : 'Novo Feedback Recebido'}
          </h2>
           
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>ID:</strong> ${user._id}</p>
            <p><strong>Nome:</strong> ${user.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Perfil:</strong> ${userLabel}</p>
            <p><strong>Tipo:</strong> ${type}</p>
          </div>

          <h3>Mensagem:</h3>
          <p style="white-space: pre-wrap; background-color: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">${message}</p>
           
          <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;" />
          <small style="color: #777;">Enviado automaticamente pelo sistema.</small>
        </div>
      `,
      replyTo: user.email,
    };

    await transporter.sendMail(mailOptions);

    user.lastFeedbackAt = new Date();
    await user.save();

    return { success: true };
  }
}

export { feedbackService }