import { Model } from 'mongoose';
import { User } from '../../models/User';
import { Professor } from '../../models/Professor';
import { createTransporter } from '../../config/resetPassword/nodemailerTransport';

interface FeedbackRequest {
  userId: string;
  userRoles: string[];
  message: string;
  type: string;
}

class feedbackService {
  async execute({ userId, userRoles, message, type }: FeedbackRequest) {
    const isStudent = userRoles.includes('student');

    const TargetModel = (isStudent ? User : Professor) as Model<any>;

    const user = await TargetModel.findById(userId);

    if (!user) {
      throw new Error('UserNotFound');
    }

    const lastFeedback = user.lastFeedbackAt;

    if (lastFeedback) {
      const now = new Date();
      const lastDate = new Date(lastFeedback);
      const diffTime = Math.abs(now.getTime() - lastDate.getTime());
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays < 3) {
        const daysRemaining = Math.ceil(3 - diffDays);
        throw new Error(`RateLimit: aguarde ${daysRemaining} dia(s) para enviar novamente.`);
      }
    }

    const userLabel = isStudent ? 'Aluno(a)' : 'Professor(a)/Coord.';

    const transporter = createTransporter(
      process.env.EMAIL_USER as string,
      process.env.EMAIL_PASS as string,
      process.env.EMAIL_DOMAIN || 'gmail.com'
    );

    const mailOptions = {
      from: `"Sistema de Feedback" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_SUPPORT,
      subject: `[${type || 'GERAL'}] Feedback de ${user.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
          <h2 style="border-bottom: 2px solid #007bff; padding-bottom: 10px;">Novo Feedback Recebido</h2>
           
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>ID:</strong> ${user._id}</p>
            <p><strong>Nome:</strong> ${user.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Perfil:</strong> ${userLabel}</p>
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