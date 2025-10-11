import mongoose, { Document, Schema, Types } from "mongoose";
import type { Query } from "mongoose";

const QuestionSchema = new Schema({
  level: { type: String, required: true },
  subject: { type: String, required: true },
  selectedOption: {
    question: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    isSelected: { type: String, required: true },
  },
  totalCorrectAnswers: { type: Number, default: 0 },
  totalWrongAnswers: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

// sub-schema para cada tentativa de quiz
const QuizAttemptSchema = new Schema({
  questions: { type: [QuestionSchema], default: [] },
  totalCorrectWrongAnswersSession: {
    totalCorrectAnswers: { type: Number, default: 0 },
    totalWrongAnswers: { type: Number, default: 0 },
  },
}, { _id: false });

const mainSubjects = [
  "variaveis",
  "listas",
  "condicionais",
  "verificacoes",
  "tipos",
  "funcoes",
  "loops"
];

const typeSubjects = [
  "textos",
  "caracteres",
  "numeros",
  "operadores_matematicos",
  "operadores_logicos",
  "operadores_ternarios",
  "soma",
  "subtracao",
  "multiplicacao",
  "divisao_inteira",
  "divisao_resto",
  "divisao_normal"
];

const allSubjects = [...mainSubjects, ...typeSubjects];

const isTypeSubject = (subject: string) => typeSubjects.includes(subject);

const extractMainSubject = (subject: string): string => {
  if (subject.includes('_')) {
    const mainPart = subject.split('_')[0];
    if (mainSubjects.includes(mainPart) || typeSubjects.includes(mainPart)) {
      return mainPart;
    }
  }
  return subject;
};

const SubjectCountsSchema = new Schema({
  variaveis: { type: Number, default: 0 },
  tipos: { type: Number, default: 0 },
  funcoes: { type: Number, default: 0 },
  loops: { type: Number, default: 0 },
  verificacoes: { type: Number, default: 0 },
}, { _id: false });

export const getEmptySubjectCounts = () => ({
  variaveis: 0,
  tipos: 0,
  funcoes: 0,
  loops: 0,
  verificacoes: 0
});

const SessionSchema = new Schema({
  sessionStart: { type: Date, default: Date.now },
  sessionEnd: { type: Date },
  sessionDuration: { type: Number, default: 0 },
  lastActivityAt: { type: Date, default: Date.now },
  totalCorrectAnswers: { type: Number, default: 0 },
  totalWrongAnswers: { type: Number, default: 0 },
  subjectCountsChat: {
    type: SubjectCountsSchema,
    default: getEmptySubjectCounts(),
    required: false
  },
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
  subjectCountsQuiz: {
    variaveis: number;
    tipos: number;
    funcoes: number;
    loops: number;
    verificacoes: number;
  };
  sessions: Array<{
    lastActivityAt: Date;
    sessionStart: Date;
    sessionEnd?: Date;
    sessionDuration?: number;
    totalCorrectAnswers: number;
    totalWrongAnswers: number;
    subjectCountsChat?: {
      variaveis: number;
      tipos: number;
      funcoes: number;
      loops: number;
      verificacoes: number;
    };
    answerHistory: Array<{
      questions: Array<{
        level: string;
        subject: string;
        selectedOption: { question: string; isCorrect: boolean; isSelected: string };
        totalCorrectAnswers: number;
        totalWrongAnswers: number;
        timestamp: Date;
      }>;
      totalCorrectWrongAnswersSession: {
        totalCorrectAnswers: number;
        totalWrongAnswers: number;
      };
    }>;
  }>;
  addAnswerHistory: (
    level: string,
    question: string,
    subject: string,
    selectedOption: string,
    isCorrect: boolean
  ) => void;
  updateSubjectCountsQuiz: (subject: string) => void;
  updateSubjectCountsChat: (subject: string, sessionIndex?: number) => void;
}

const UserAnalysisSchema = new Schema<IUserAnalysis>({
  userId: { type: String, required: true, index: true },
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
  subjectCountsQuiz: {
    variaveis: { type: Number, default: 0 },
    tipos: { type: Number, default: 0 },
    funcoes: { type: Number, default: 0 },
    loops: { type: Number, default: 0 },
    verificacoes: { type: Number, default: 0 },
  },
  sessions: { type: [SessionSchema], default: [] },
});

UserAnalysisSchema.pre(/^find/, function (this: Query<any, IUserAnalysis>, next) {
  this.populate("schoolId", "name");
  this.populate("courseId", "name");
  this.populate("classId", "name");
  next();
});

UserAnalysisSchema.pre("save", function (next) {
  const last = this.sessions.at(-1);
  if (last?.sessionStart && last?.sessionEnd) {
    last.sessionDuration =
      (last.sessionEnd.getTime() - last.sessionStart.getTime()) / 1000;
  }
  next();
});

UserAnalysisSchema.methods.updateSubjectCountsQuiz = function (subject: string) {
  const mainSubject = extractMainSubject(subject);

  if (mainSubject in this.subjectCountsQuiz) {
    this.subjectCountsQuiz[mainSubject] += 1;
  }

  if (isTypeSubject(mainSubject) && "tipos" in this.subjectCountsQuiz) {
    this.subjectCountsQuiz["tipos"] += 1;
  }

  this.markModified('subjectCountsQuiz');
};

UserAnalysisSchema.methods.updateSubjectCountsChat = function (subject: string, sessionIndex?: number) {
  const idx = sessionIndex !== undefined ? sessionIndex : this.sessions.length - 1;

  if (!this.sessions[idx]) return;

  const mainSubject = extractMainSubject(subject);

  if (!this.sessions[idx].subjectCountsChat) {
    this.sessions[idx].subjectCountsChat = getEmptySubjectCounts();
  }

  if (mainSubject in this.sessions[idx].subjectCountsChat) {
    this.sessions[idx].subjectCountsChat[mainSubject] += 1;
  }

  if (isTypeSubject(mainSubject) && "tipos" in this.sessions[idx].subjectCountsChat) {
    this.sessions[idx].subjectCountsChat["tipos"] += 1;
  }

  this.markModified(`sessions.${idx}.subjectCountsChat`);
};

UserAnalysisSchema.methods.addAnswerHistory = function (
  level: string,
  question: string,
  subject: string,
  selectedOption: string,
  isCorrect: boolean
) {
  const last = this.sessions.at(-1);
  if (!last || last.sessionEnd) return;

  let attempt = last.answerHistory.at(-1);
  if (!attempt) {
    attempt = {
      questions: [],
      totalCorrectWrongAnswersSession: {
        totalCorrectAnswers: 0,
        totalWrongAnswers: 0
      }
    };
    last.answerHistory.push(attempt);
  }

  const correctCount = isCorrect ? 1 : 0;
  const wrongCount = isCorrect ? 0 : 1;

  attempt.questions.push({
    level,
    subject,
    selectedOption: { question, isCorrect, isSelected: selectedOption },
    totalCorrectAnswers: correctCount,
    totalWrongAnswers: wrongCount,
    timestamp: new Date(),
  });

  attempt.totalCorrectWrongAnswersSession.totalCorrectAnswers += correctCount;
  attempt.totalCorrectWrongAnswersSession.totalWrongAnswers += wrongCount;
};

export const UserAnalysis = mongoose.model<IUserAnalysis>(
  "UserAnalysis",
  UserAnalysisSchema
);