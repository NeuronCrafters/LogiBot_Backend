import mongoose, { Document, Schema } from "mongoose";

interface IQuestion {
  question: string;
  options: string[];
}

interface IFaqStore extends Document {
  nivel: string;
  assunto: string;
  subassunto: string;
  questions: IQuestion[];
  answer_keys: string[];
}

const QuestionSchema = new Schema<IQuestion>({
  question: { type: String, required: true },
  options: [{ type: String, required: true }]
});

const FaqStoreSchema = new Schema<IFaqStore>(
  {
    nivel: { type: String, required: true },
    assunto: { type: String, required: true },
    subassunto: { type: String, required: true },
    questions: {
      type: [QuestionSchema],
      required: true,
      validate: [arr => arr.length === 5, "São necessárias exatamente 5 perguntas."]
    },
    answer_keys: {
      type: [String],
      required: true,
      validate: [arr => arr.length === 5, "São necessários exatamente 5 gabaritos."]
    }
  },
  {
    timestamps: true
  }
);

FaqStoreSchema.index(
  {
    nivel: 1,
    assunto: 1,
    subassunto: 1,
    "questions.question": 1,
    "questions.options": 1
  },
  { unique: true }
);

const FaqStore = mongoose.model<IFaqStore>("FaqStore", FaqStoreSchema);

export { FaqStore, IFaqStore };
