import mongoose, { Document, Schema } from "mongoose";

interface IUserAnalysis extends Document {
  userId: string;
  startTime: Date;
  endTime?: Date;
  totalTime?: number;
  outOfScopeQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  totalQuestionsAnswered: number;
  taxaDeAcertos: number;
  taxaDeErros: number;
  interacoesForaDaSala?: { timestamp: Date }[];
  dispositivo?: string;
  level?: string;
  courses?: string;
  classes?: string;
  interactions: { timestamp: Date; message: string; botResponse?: string }[];
  answerHistory: {
    question_id: string;
    selectedOption: string;
    isCorrect: boolean;
    timestamp: Date;
  }[];
}

const UserAnalysisSchema = new Schema<IUserAnalysis>({
  userId: { type: String, required: true, index: true },
  startTime: { type: Date, required: true, default: Date.now },
  endTime: { type: Date },
  totalTime: { type: Number, default: 0 },
  outOfScopeQuestions: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  wrongAnswers: { type: Number, default: 0 },
  totalQuestionsAnswered: { type: Number, default: 0 },
  taxaDeAcertos: { type: Number, default: 0 },
  taxaDeErros: { type: Number, default: 0 },
  interacoesForaDaSala: { type: [{ timestamp: { type: Date } }], default: [] },
  interactions: [{ timestamp: { type: Date }, message: { type: String }, botResponse: { type: String, default: "" } }],
  dispositivo: { type: String, default: "desconhecido" },
  level: { type: String, default: "desconhecido" },
  courses: { type: String, default: "desconhecido" },
  classes: { type: String, default: "desconhecido" },
  answerHistory: [
    {
      question_id: { type: String, required: true },
      selectedOption: { type: String, required: true },
      isCorrect: { type: Boolean, required: true },
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

UserAnalysisSchema.pre("save", function (next) {
  if (this.endTime && this.startTime) {
    this.totalTime = (this.endTime.getTime() - this.startTime.getTime()) / 1000;
  }
  next();
});

const UserAnalysis = mongoose.model<IUserAnalysis>("UserAnalysis", UserAnalysisSchema);
export { UserAnalysis, IUserAnalysis };
