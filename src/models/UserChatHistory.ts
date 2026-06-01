import { createSqlCompatModel } from "./sqlCompatModel";

export interface IUserChatHistory {
  _id?: string;
  id?: string;
  userId: string;
  topicCounts?: Record<string, number>;
  sessions?: any[];
  addMessageToSession?: (sessionId: string, message: { role: string; content: string; detectedTopic?: string }) => Promise<void>;
}

export const UserChatHistory = createSqlCompatModel("UserChatHistory");
