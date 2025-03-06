import mongoose from "mongoose";

const FAQStoreSchema = new mongoose.Schema({
  group_id: { type: String, required: true, unique: true },
  subject: { type: String, required: true },
  nivel: { type: String, required: true },
  questions: [
    {
      question: { type: String, required: true },
      options: [{ type: String, required: true }],
    },
  ],
  answer_keys: [{ type: String, required: true }],
  created_at: { type: Date, default: Date.now },
});

export const FAQStore = mongoose.model("FAQStore", FAQStoreSchema);
