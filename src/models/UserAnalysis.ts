import mongoose, { Document, Schema } from "mongoose";

interface IUserAnalysis extends Document {
  userId: string;
  sessionStart: Date; //quando a sessão começou
  sessionEnd?: Date; //quando a sessão acabou
  sessionDuration?: number; //duração da sessão
  outOfScopeQuestions: number; //questões fora do escopo dado
  correctAnswers: number; //números de questões corretas
  wrongAnswers: number; //números de questões erradas
  totalQuestionsAnswered: number; //número total de questões
  successRate: number; //taxa de acertos
  errorRate: number; //taxa de erros
  interactionsOutsideTheClassroom?: { timestamp: Date }[]; //interacoes fora de sala
  device?: string; //tipo do dispositivo
  level?: string; //nível escolhido pelo user
  school: string; //universidade
  courses: string; //curso
  classes: string; //turma
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
  sessionStart: { type: Date, required: true, default: Date.now },
  sessionEnd: { type: Date },
  sessionDuration: { type: Number, default: 0 },
  outOfScopeQuestions: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  wrongAnswers: { type: Number, default: 0 },
  totalQuestionsAnswered: { type: Number, default: 0 },
  successRate: { type: Number, default: 0 },
  errorRate: { type: Number, default: 0 },
  interactionsOutsideTheClassroom: { type: [{ timestamp: { type: Date } }], default: [] },
  interactions: [
    { timestamp: { type: Date }, message: { type: String }, botResponse: { type: String, default: "" } }
  ],
  device: { type: String, default: "desconhecido" },
  level: { type: String, default: "desconhecido" },
  school: { type: String, required: true },
  courses: { type: String, required: true },
  classes: { type: String, required: true },
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
  if (this.sessionEnd && this.sessionStart) {
    this.sessionDuration = (this.sessionEnd.getTime() - this.sessionStart.getTime()) / 1000;
  }
  next();
});

const UserAnalysis = mongoose.model<IUserAnalysis>("UserAnalysis", UserAnalysisSchema);
export { UserAnalysis, IUserAnalysis };
