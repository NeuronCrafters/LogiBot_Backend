import mongoose, { Document, Schema } from "mongoose";

interface IFAQStore extends Document {
  group_id: string;
  subject: string;
  nivel: "basico" | "intermediario" | "avancado";
  questions: {
    question_id: string;
    question: string;
    options: string[];
  }[];
  answer_keys: string[];
  user_answers?: {
    userId: string;
    question_id: string;
    selectedOption: string;
    isCorrect: boolean;
    timestamp: Date;
  }[];
  created_at: Date;
}

const FAQStoreSchema = new Schema<IFAQStore>({
  group_id: { type: String, required: true, unique: true },
  subject: { type: String, required: true, unique: false },
  nivel: {
    type: String,
    required: true,
    enum: ["basico", "intermediario", "avancado"],
  },
  questions: [
    {
      question_id: { type: String, required: true },
      question: { type: String, required: true },
      options: [{ type: String, required: true }],
    },
  ],
  answer_keys: [{ type: String, required: true }],
  user_answers: [
    {
      userId: { type: String, required: true },
      question_id: { type: String, required: true },
      selectedOption: { type: String, required: true },
      isCorrect: { type: Boolean, required: true },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  created_at: { type: Date, default: Date.now },
});

export const FAQStore = mongoose.model<IFAQStore>("FAQStore", FAQStoreSchema);
