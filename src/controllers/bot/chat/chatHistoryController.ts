import { Request, Response } from "express";
import { ChatHistoryService } from "../../../services/bot/chat/chatHistoryService";

class ChatHistoryController {

  async handleGetSessions(req: Request, res: Response): Promise<Response> {
    const { userId } = req.params;
    const service = new ChatHistoryService();

    try {
      const sessions = await service.getUserSessions(userId);
      return res.json(sessions);
    } catch (error: any) {
      return res.status(500).json({ error: "Erro ao buscar sessões." });
    }
  }

  async handleGetMessages(req: Request, res: Response): Promise<Response> {
    const { userId, sessionId } = req.params;
    const service = new ChatHistoryService();

    try {
      const chat = await service.getSessionMessages(userId, sessionId);
      return res.json(chat);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export { ChatHistoryController };