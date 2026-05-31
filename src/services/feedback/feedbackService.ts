import { Model } from 'mongoose';
import { User } from '../../models/User';
import { Professor } from '../../models/Professor';

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

    user.lastFeedbackAt = new Date();
    await user.save();

    return {
      success: true,
      message: 'Feedback recebido. Envio por e-mail foi removido nesta versão.',
      feedback: {
        userId: String(user._id),
        name: user.name,
        email: user.email,
        type,
        message,
      },
    };
  }
}

export { feedbackService }
