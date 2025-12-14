import mongoose, { Document, Schema } from "mongoose";

const MessageSchema = new Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  detectedTopic: { type: String }
}, { _id: false });

const ChatSessionSchema = new Schema({
  sessionId: { type: String, required: true },
  title: { type: String, default: "Nova Conversa" },
  startedAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
  messages: { type: [MessageSchema], default: [] }
}, { _id: false });

export interface IUserChatHistory extends Document {
  userId: string;
  sessions: Array<{
    sessionId: string;
    title: string;
    startedAt: Date;
    lastActivityAt: Date;
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: Date;
      detectedTopic?: string;
    }>;
  }>;
  addMessageToSession: (
    sessionId: string,
    message: { role: string; content: string; detectedTopic?: string }
  ) => Promise<void>;
}

const UserChatHistorySchema = new Schema<IUserChatHistory>({
  userId: { type: String, required: true, unique: true, index: true },
  sessions: { type: [ChatSessionSchema], default: [] }
}, {
  collection: 'chathistories'
});

UserChatHistorySchema.index({ userId: 1 });
UserChatHistorySchema.index({ "sessions.sessionId": 1 });

UserChatHistorySchema.methods.addMessageToSession = async function (
  sessionId: string,
  message: { role: string; content: string; detectedTopic?: string }
) {
  const sessionIndex = this.sessions.findIndex((s) => s.sessionId === sessionId);

  const newMessage = {
    role: message.role,
    content: message.content,
    detectedTopic: message.detectedTopic,
    timestamp: new Date()
  };

  if (sessionIndex >= 0) {
    this.sessions[sessionIndex].messages.push(newMessage);
    this.sessions[sessionIndex].lastActivityAt = new Date();

    if (this.sessions[sessionIndex].title === "Nova Conversa" && message.role === 'user') {
      const generatedTitle = message.content.substring(0, 30) + (message.content.length > 30 ? "..." : "");
      this.sessions[sessionIndex].title = generatedTitle;
    }

    this.markModified('sessions');
  } else {
    let initialTitle = "Nova Conversa";

    if (message.role === 'user') {
      initialTitle = message.content.substring(0, 30) + (message.content.length > 30 ? "..." : "");
    }

    const newSession = {
      sessionId: sessionId,
      title: initialTitle,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      messages: [newMessage]
    };

    this.sessions.push(newSession);
  }

  return this.save();
};

export const UserChatHistory = mongoose.model<IUserChatHistory>(
  "UserChatHistory",
  UserChatHistorySchema
);