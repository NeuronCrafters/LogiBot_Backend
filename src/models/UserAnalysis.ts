import mongoose, { Document, Schema, Types } from "mongoose";
import type { Query } from "mongoose";

// sub-schema para cada questão respondida
const QuestionSchema = new Schema({
  level: { type: String, required: true },
  subject:  { type: String, required: true },
  selectedOption: {
    question: { type: String, required: true },
    isCorrect:  { type: Boolean, required: true },
    isSelected: { type: String,  required: true },
  },
  totalCorrectAnswers: { type: Number, default: 0 },
  totalWrongAnswers: { type: Number, default: 0 },
  timestamp: { type: Date,   default: Date.now },
}, { _id: false });

// sub-schema para cada tentativa de quiz
const QuizAttemptSchema = new Schema({
  questions: { type: [QuestionSchema], default: [] },
  subjectCorrectCount: { type: Map, of: Number, default: {} },
  subjectWrongCount: { type: Map, of: Number, default: {} },
}, { _id: false });

// sub-schema para cada sessão de uso
const SessionSchema = new Schema({
  sessionStart: { type: Date, default: Date.now },
  sessionEnd: { type: Date },
  sessionDuration: { type: Number, default: 0 },
  totalCorrectAnswers: { type: Number, default: 0 },
  totalWrongAnswers: { type: Number, default: 0 },
  subjectFrequency: { type: Map, of: Number, default: {} },
  answerHistory: { type: [QuizAttemptSchema], default: [] },
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
  };
  sessions: Array<{
    sessionStart: Date;
    sessionEnd?: Date;
    sessionDuration?: number;
    totalCorrectAnswers: number;
    totalWrongAnswers: number;
    subjectFrequency: Map<string, number>;
    answerHistory: Array<{
      questions: Array<{
        level: string;
        subject: string;
        selectedOption: { question: string; isCorrect: boolean; isSelected: string };
        totalCorrectAnswers: number;
        totalWrongAnswers: number;
        timestamp: Date;
      }>;
      subjectCorrectCount: Map<string, number>;
      subjectWrongCount: Map<string, number>;
    }>;
  }>;
  addAnswerHistory: (
      level: string,
      question: string,
      subject: string,
      selectedOption: string,
      isCorrect: boolean
  ) => void;
}

const UserAnalysisSchema = new Schema<IUserAnalysis>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  schoolName: { type: String, required: true },
  courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
  courseName: { type: String, required: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
  className: { type: String, required: true },
  totalUsageTime: { type: Number, default: 0 },
  totalCorrectWrongAnswers: {
    totalCorrectAnswers: { type: Number, default: 0 },
    totalWrongAnswers:   { type: Number, default: 0 },
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
  this.populate("schoolId", "name");
  this.populate("courseId", "name");
  this.populate("classId",  "name");
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

  // cria uma nova tentativa de quiz se necessário
  let attempt = last.answerHistory.at(-1);
  if (!attempt) {
    attempt = { questions: [], subjectCorrectCount: new Map(), subjectWrongCount: new Map() };
    last.answerHistory.push(attempt);
  }

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

  // atualiza contadores por assunto
  attempt.subjectCorrectCount.set(
      subject,
      (attempt.subjectCorrectCount.get(subject) || 0) + correctCount
  );
  attempt.subjectWrongCount.set(
      subject,
      (attempt.subjectWrongCount.get(subject)   || 0) + wrongCount
  );
};

export const UserAnalysis = mongoose.model<IUserAnalysis>(
    "UserAnalysis",
    UserAnalysisSchema
);
