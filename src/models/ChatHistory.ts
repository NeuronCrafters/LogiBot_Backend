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

export interface IChatHistory extends Document {
  userId: string;
  sessionId: string;
  title?: string;
  startedAt: Date;
  lastActivityAt: Date;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    detectedTopic?: string;
  }>;
}

const ChatHistorySchema = new Schema<IChatHistory>({
  userId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, unique: true, index: true },
  title: { type: String, default: "Nova Conversa" },
  startedAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
  messages: { type: [MessageSchema], default: [] }
});

ChatHistorySchema.index({ userId: 1, lastActivityAt: -1 });

export const ChatHistory = mongoose.model<IChatHistory>("ChatHistory", ChatHistorySchema);