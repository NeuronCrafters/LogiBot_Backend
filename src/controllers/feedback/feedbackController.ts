import { Request, Response } from 'express';
import { feedbackService } from '../../services/feedback/feedbackService';
import { AgentModerationService } from '../../services/agentModeration/agentModerationService';

class feedbackController {
  async handle(req: Request, res: Response): Promise<Response> {
    const { message, type } = req.body;
    const userId = req.user?.id;
    const userRoles = req.user?.role || [];

    if (!userId) {
      return res.status(401).json({ error: 'usuário não autenticado.' });
    }

    if (!message) {
      return res.status(400).json({ error: 'a mensagem é obrigatória.' });
    }

    if (message.length > 5) {
      const moderator = new AgentModerationService();
      const analysis = await moderator.checkContent(message);

      if (!analysis.safe) {
        return res.status(400).json({
          error: `Mensagem bloqueada: ${analysis.reason || 'Conteúdo impróprio detectado.'}`
        });
      }
    }

    const feedbackServices = new feedbackService();

    try {
      await feedbackServices.execute({
        userId,
        userRoles,
        message,
        type
      });

      return res.status(200).json({ message: 'feedback enviado com sucesso!' });

    } catch (err: any) {

      if (err.message === 'UserNotFound') {
        return res.status(404).json({ error: 'usuário não encontrado.' });
      }

      if (err.message.startsWith('RateLimit:')) {
        const cleanMessage = err.message.replace('RateLimit:', '');
        return res.status(429).json({ error: cleanMessage });
      }

      console.error(err);
      return res.status(500).json({ error: 'erro interno ao enviar feedback.' });
    }
  }
}

export { feedbackController };