import mongoose, { Document, Schema } from "mongoose";

const mainSubjects = [
  "variaveis", "listas", "condicionais", "verificacoes",
  "funcoes", "repeticao", "operadores_logicos"
];

const normalizeSubject = (subject: string): string => {
  if (!subject) return "outros";
  const lower = subject.toLowerCase().trim();

  if (mainSubjects.includes(lower)) return lower;

  const parts = lower.split('_');
  if (mainSubjects.includes(parts[0])) return parts[0];

  return "outros";
};

const SubjectCountsSchema = new Schema({
  variaveis: { type: Number, default: 0 },
  listas: { type: Number, default: 0 },
  condicionais: { type: Number, default: 0 },
  operadores_logicos: { type: Number, default: 0 },
  funcoes: { type: Number, default: 0 },
  repeticao: { type: Number, default: 0 },
  verificacoes: { type: Number, default: 0 },
  outros: { type: Number, default: 0 }
}, { _id: false });

const QuestionAttemptSchema = new Schema({
  question: { type: String, required: true },
  selectedOption: { type: String, required: true },
  isCorrect: { type: Boolean, required: true },
  subject: { type: String, required: true },
  level: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const QuizSessionSchema = new Schema({
  quizId: { type: String, required: true },
  title: { type: String, default: "Quiz Prático" },
  completedAt: { type: Date, default: Date.now },
  totalQuestions: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  questions: { type: [QuestionAttemptSchema], default: [] }
}, { _id: false });

export interface IUserQuizHistory extends Document {
  userId: string;
  subjectCounts: {
    variaveis: number;
    listas: number;
    condicionais: number;
    operadores_logicos: number;
    funcoes: number;
    repeticao: number;
    verificacoes: number;
    outros: number;
  };
  sessions: Array<{
    quizId: string;
    title: string;
    completedAt: Date;
    totalQuestions: number;
    score: number;
    questions: Array<{
      question: string;
      selectedOption: string;
      isCorrect: boolean;
      subject: string;
      level?: string;
    }>;
  }>;
  addQuizAttempt: (
    quizId: string,
    questionsData: Array<{
      question: string;
      selectedOption: string;
      isCorrect: boolean;
      subject: string;
      level?: string;
    }>,
    customTitle?: string
  ) => Promise<void>;
}

const UserQuizHistorySchema = new Schema<IUserQuizHistory>({
  userId: { type: String, required: true, unique: true, index: true },
  subjectCounts: { type: SubjectCountsSchema, default: () => ({}) },
  sessions: { type: [QuizSessionSchema], default: [] }
}, {
  collection: 'quizhistories'
});

UserQuizHistorySchema.index({ userId: 1 });
UserQuizHistorySchema.index({ "sessions.quizId": 1 });

UserQuizHistorySchema.methods.addQuizAttempt = async function (
  quizId: string,
  questionsData: Array<any>,
  customTitle?: string
) {
  const totalQuestions = questionsData.length;
  const score = questionsData.filter(q => q.isCorrect).length;

  const newSession = {
    quizId,
    title: customTitle || `Quiz - ${new Date().toLocaleDateString('pt-BR')}`,
    completedAt: new Date(),
    totalQuestions,
    score,
    questions: questionsData
  };

  questionsData.forEach((q) => {
    const key = normalizeSubject(q.subject);

    if (this.subjectCounts && typeof (this.subjectCounts as any)[key] === 'number') {
      (this.subjectCounts as any)[key]++;
    } else {
      if (this.subjectCounts) this.subjectCounts.outros++;
    }
  });

  this.sessions.push(newSession);

  this.markModified('sessions');
  this.markModified('subjectCounts');

  return this.save();
};

export const UserQuizHistory = mongoose.model<IUserQuizHistory>(
  "UserQuizHistory",
  UserQuizHistorySchema
);