import mongoose, { Document, Schema, Types } from "mongoose";
import type { Query } from "mongoose";
import { normalizeSubjectFromMessage } from "../utils/normalizeSubject";

// sub-schema para cada questão respondida
const QuestionSchema = new Schema({
  level: { type: String, required: true },
  subject: { type: String, required: true },
  selectedOption: {
    question: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    isSelected: { type: String,  required: true },
  },
  totalCorrectAnswers: { type: Number, default: 0 },
  totalWrongAnswers: { type: Number, default: 0 },
  timestamp: { type: Date,   default: Date.now },
}, { _id: false });

// sub-schema para cada tentativa de quiz
const QuizAttemptSchema = new Schema({
  questions: { type: [QuestionSchema], default: [] },
}, { _id: false });

// sub-schema para cada sessão de uso
const SessionSchema = new Schema({
  sessionStart: { type: Date, default: Date.now },
  sessionEnd: { type: Date },
  sessionDuration: { type: Number, default: 0 },
  totalCorrectAnswers: { type: Number, default: 0 },
  totalWrongAnswers: { type: Number, default: 0 },
  frequency: { type: Map, of: Number, default: {} },
  quizHistory: { type: [QuizAttemptSchema], default: [] },
}, { _id: false });

export interface IUserAnalysis extends Document {
  userId: string;
  name: string;
  email: string;
  schoolId: Types.ObjectId;
  schoolName: string;
  courseId: Types.ObjectId;
  courseName: string;
  classId: Types.ObjectId;
  className: string;
  totalUsageTime: number;
  totalCorrectWrongAnswers: {
    totalCorrectAnswers: number;
    totalWrongAnswers: number;
  };
  subjectCounts: {
    variaveis: number;
    tipos: number;
    funcoes: number;
    loops: number;
    verificacoes: number;
    operacoes: number;
  };
  sessions: Array<{
    sessionStart: Date;
    sessionEnd?: Date;
    sessionDuration?: number;
    totalCorrectAnswers: number;
    totalWrongAnswers: number;
    frequency: Map<string, number>;
    quizHistory: Array<{
      questions: Array<{
        level: string;
        subject: string;
        selectedOption: { question: string; isCorrect: boolean; isSelected: string };
        totalCorrectAnswers: number;
        totalWrongAnswers: number;
        timestamp: Date;
      }>;
    }>;
  }>;
  addAnswerHistory: (
      level: string,
      question: string,
      subject: string,
      selectedOption: string,
      isCorrect: boolean
  ) => void;
  addInteraction: (subjectMatched: string) => void;
}

const UserAnalysisSchema = new Schema<IUserAnalysis>({
  userId:   { type: String, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  schoolId: { type: Schema.Types.ObjectId, ref: "University", required: true },
  schoolName: { type: String, required: true },
  courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
  courseName: { type: String, required: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
  className: { type: String, required: true },
  totalUsageTime: { type: Number, default: 0 },
  totalCorrectWrongAnswers: {
    totalCorrectAnswers: { type: Number, default: 0 },
    totalWrongAnswers: { type: Number, default: 0 },
  },
  subjectCounts: {
    variaveis: { type: Number, default: 0 },
    tipos: { type: Number, default: 0 },
    funcoes: { type: Number, default: 0 },
    loops: { type: Number, default: 0 },
    verificacoes: { type: Number, default: 0 },
  },
  sessions: { type: [SessionSchema], default: [] },
});

// auto-populate de schoolId, courseId e classId com seus nomes
UserAnalysisSchema.pre(/^find/, function(this: Query<any, IUserAnalysis>, next) {
  this.populate("schoolId", "name")
      .populate("courseId", "name")
      .populate("classId",  "name");
  next();
});

// atualiza sessionDuration antes de salvar
UserAnalysisSchema.pre("save", function (next) {
  const last = this.sessions.at(-1);
  if (last?.sessionStart && last?.sessionEnd) {
    last.sessionDuration =
        (last.sessionEnd.getTime() - last.sessionStart.getTime()) / 1000;
  }
  next();
});

// metodo para registrar histórico de respostas
UserAnalysisSchema.methods.addAnswerHistory = function (
    level: string,
    question: string,
    subject: string,
    selectedOption: string,
    isCorrect: boolean
) {
  const last = this.sessions.at(-1);
  if (!last || last.sessionEnd) return;

  const newAttempt = { questions: [] };
  last.quizHistory.push(newAttempt);

  const attempt = newAttempt;


  const correctCount = isCorrect ? 1 : 0;
  const wrongCount   = isCorrect ? 0 : 1;

  attempt.questions.push({
    level,
    subject,
    selectedOption: { question, isCorrect, isSelected: selectedOption },
    totalCorrectAnswers: correctCount,
    totalWrongAnswers:   wrongCount,
    timestamp:           new Date(),
  });

  // atualiza totais de sessão também
  last.totalCorrectAnswers = (last.totalCorrectAnswers || 0) + correctCount;
  last.totalWrongAnswers   = (last.totalWrongAnswers   || 0) + wrongCount;
};

// metodo para registrar apenas os contadores de assunto
UserAnalysisSchema.methods.addInteraction = function (subjectMatched: string) {
  const normalized = normalizeSubjectFromMessage(subjectMatched);

  if (!normalized) return;

  // Atualiza o contador global
  this.subjectCounts[normalized] = (this.subjectCounts[normalized] || 0) + 1;

  // Atualiza o contador da sessão
  const last = this.sessions.at(-1);
  if (!last || last.sessionEnd) return;

  const freqMap = last.frequency as Map<string, number>;
  const prev = freqMap.get(normalized) || 0;
  freqMap.set(normalized, prev + 1);
  last.frequency = freqMap;
};


export const UserAnalysis = mongoose.model<IUserAnalysis>(
    "UserAnalysis",
    UserAnalysisSchema
);
