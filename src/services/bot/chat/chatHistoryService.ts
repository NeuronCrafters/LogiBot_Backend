import { ChatHistory } from "../../../models/ChatHistory";
import { AppError } from "../../../exceptions/AppError";
import { v4 as uuidv4 } from 'uuid';

interface AddMessageDTO {
  userId: string;
  sessionId?: string;
  role: 'user' | 'assistant';
  content: string;
  topic?: string;
}

class ChatHistoryService {

  async addMessage({ userId, sessionId, role, content, topic }: AddMessageDTO) {
    let currentSessionId = sessionId;

    if (!currentSessionId) {
      currentSessionId = uuidv4();
    }

    const messageData = {
      role,
      content,
      timestamp: new Date(),
      detectedTopic: topic
    };

    const chat = await ChatHistory.findOneAndUpdate(
      { userId, sessionId: currentSessionId },
      {
        $push: { messages: messageData },
        $set: { lastActivityAt: new Date() },
        $setOnInsert: { startedAt: new Date(), title: "Nova Conversa" }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return chat;
  }

  async getUserSessions(userId: string) {
    const sessions = await ChatHistory.find({ userId })
      .select("sessionId title startedAt lastActivityAt")
      .sort({ lastActivityAt: -1 })
      .lean();

    return sessions;
  }

  async getSessionMessages(userId: string, sessionId: string) {
    const chat = await ChatHistory.findOne({ userId, sessionId }).lean();

    if (!chat) {
      throw new AppError("Sessão de chat não encontrada.", 404);
    }

    return chat;
  }

  async updateSessionTitle(userId: string, sessionId: string, newTitle: string) {
    await ChatHistory.updateOne(
      { userId, sessionId },
      { title: newTitle }
    );
  }
}

export { ChatHistoryService };