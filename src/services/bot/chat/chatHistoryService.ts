import { UserChatHistory } from "../../../models/UserChatHistory";
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

    let userHistory = await UserChatHistory.findOne({ userId });

    if (!userHistory) {
      userHistory = new UserChatHistory({ userId, sessions: [] });
    }

    await userHistory.addMessageToSession(currentSessionId, {
      role,
      content,
      detectedTopic: topic
    });

    return {
      sessionId: currentSessionId,
      userId
    };
  }

  async getUserSessions(userId: string) {
    const userHistory = await UserChatHistory.findOne({ userId }).lean();

    if (!userHistory || !userHistory.sessions) {
      return [];
    }

    return userHistory.sessions
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
      .map(session => ({
        sessionId: session.sessionId,
        title: session.title,
        startedAt: session.startedAt,
        lastActivityAt: session.lastActivityAt
      }));
  }

  async getSessionMessages(userId: string, sessionId: string) {
    const userHistory = await UserChatHistory.findOne(
      { userId, "sessions.sessionId": sessionId },
      { "sessions.$": 1 }
    ).lean();

    if (!userHistory || !userHistory.sessions || userHistory.sessions.length === 0) {
      return { messages: [] };
    }

    return userHistory.sessions[0];
  }

  async updateSessionTitle(userId: string, sessionId: string, newTitle: string) {
    await UserChatHistory.updateOne(
      { userId, "sessions.sessionId": sessionId },
      { $set: { "sessions.$.title": newTitle } }
    );
  }
}

export { ChatHistoryService };