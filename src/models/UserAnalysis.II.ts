import mongoose, { Document, Schema, Types } from "mongoose";
import type { Query } from "mongoose";

// futuro novo modelo para analisar os dados do usuario
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

const QuizAttemptSchema = new Schema({
  questions: { type: [QuestionSchema], default: [] },
  totalCorrectWrongAnswersSession: {
    totalCorrectAnswers: { type: Number, default: 0 },
    totalWrongAnswers: { type: Number, default: 0 },
  },
}, { _id: false });


const SubjectCountsSchema = new Schema({
  // Fundamentos & Lógica
  variaveis_tipos: { type: Number, default: 0 }, operadores: { type: Number, default: 0 }, estruturas_controle: { type: Number, default: 0 }, funcoes: { type: Number, default: 0 }, escopo: { type: Number, default: 0 }, entrada_saida: { type: Number, default: 0 }, tratamento_erros: { type: Number, default: 0 },
  // Estruturas de Dados
  estruturas_dados_conceitos: { type: Number, default: 0 }, estruturas_dados_lineares: { type: Number, default: 0 }, estruturas_dados_nao_lineares: { type: Number, default: 0 },
  // Algoritmos
  algoritmos_conceitos: { type: Number, default: 0 }, algoritmos_ordenacao: { type: Number, default: 0 }, algoritmos_busca: { type: Number, default: 0 }, algoritmos_grafos: { type: Number, default: 0 }, algoritmos_paradigmas: { type: Number, default: 0 },
  // OOP
  oop_conceitos: { type: Number, default: 0 }, oop_pilares: { type: Number, default: 0 }, design_patterns: { type: Number, default: 0 },
  // Avançados
  arquivos_io: { type: Number, default: 0 }, seguranca_cripto: { type: Number, default: 0 }, redes_protocolos: { type: Number, default: 0 }, sistemas_operacionais: { type: Number, default: 0 }, banco_de_dados: { type: Number, default: 0 }, devops_cloud: { type: Number, default: 0 }, linguagens_ferramentas: { type: Number, default: 0 },
  // Geral
  code: { type: Number, default: 0 }, quiz: { type: Number, default: 0 },
}, { _id: false });

export const getEmptySubjectCounts = () => ({
  variaveis_tipos: 0, operadores: 0, estruturas_controle: 0, funcoes: 0, escopo: 0, entrada_saida: 0, tratamento_erros: 0,
  estruturas_dados_conceitos: 0, estruturas_dados_lineares: 0, estruturas_dados_nao_lineares: 0,
  algoritmos_conceitos: 0, algoritmos_ordenacao: 0, algoritmos_busca: 0, algoritmos_grafos: 0, algoritmos_paradigmas: 0,
  oop_conceitos: 0, oop_pilares: 0, design_patterns: 0,
  arquivos_io: 0, seguranca_cripto: 0, redes_protocolos: 0, sistemas_operacionais: 0, banco_de_dados: 0, devops_cloud: 0, linguagens_ferramentas: 0,
  code: 0, quiz: 0
});

// --- Mapeamento para o Sumário Virtual ---
const summaryMapping = {
  variaveis: ['variaveis_tipos'],
  tipos: ['variaveis_tipos', 'operadores', 'estruturas_dados_conceitos', 'estruturas_dados_lineares', 'estruturas_dados_nao_lineares'],
  funcoes: ['funcoes', 'escopo', 'oop_conceitos', 'design_patterns'],
  loops: ['estruturas_controle'],
  verificacoes: ['estruturas_controle', 'tratamento_erros', 'algoritmos_conceitos', 'algoritmos_busca']
};

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
  },
  answerHistory: { type: [QuizAttemptSchema], default: [] },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

SessionSchema.virtual('summarySubjectCountsChat').get(function () {
  const summary = { variaveis: 0, tipos: 0, funcoes: 0, loops: 0, verificacoes: 0 };
  const subjectCounts = this.subjectCountsChat;
  if (!subjectCounts) return summary;
  for (const summaryKey in summaryMapping) {
    const detailedSubjects = summaryMapping[summaryKey as keyof typeof summaryMapping];
    let total = 0;
    for (const detailedKey of detailedSubjects) {
      if (subjectCounts[detailedKey]) {
        total += subjectCounts[detailedKey];
      }
    }
    summary[summaryKey as keyof typeof summary] = total;
  }
  return summary;
});

export interface IUserAnalysisII extends Document {
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
  totalCorrectWrongAnswers: { totalCorrectAnswers: number; totalWrongAnswers: number; };
  subjectCountsQuiz: { variaveis: number; tipos: number; funcoes: number; loops: number; verificacoes: number; };
  sessions: Array<{
    lastActivityAt: Date;
    sessionStart: Date;
    sessionEnd?: Date;
    sessionDuration?: number;
    totalCorrectAnswers: number;
    totalWrongAnswers: number;
    subjectCountsChat?: any;
    summarySubjectCountsChat?: { variaveis: number; tipos: number; funcoes: number; loops: number; verificacoes: number; };
    answerHistory: Array<any>;
  }>;
  addAnswerHistory: (level: string, question: string, subject: string, selectedOption: string, isCorrect: boolean) => void;
  updateSubjectCountsQuiz: (subject: string) => void;
  updateSubjectCountsChat: (subject: string, sessionIndex?: number) => void;
}

const UserAnalysisIISchema = new Schema<IUserAnalysisII>({
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

UserAnalysisIISchema.pre(/^find/, function (this: Query<any, IUserAnalysisII>, next) {
  this.populate("schoolId", "name");
  this.populate("courseId", "name");
  this.populate("classId", "name");
  next();
});

UserAnalysisIISchema.pre("save", function (next) {
  const last = this.sessions.at(-1);
  if (last?.sessionStart && last?.sessionEnd) {
    last.sessionDuration = (last.sessionEnd.getTime() - last.sessionStart.getTime()) / 1000;
  }
  next();
});

UserAnalysisIISchema.methods.updateSubjectCountsQuiz = function (subject: string) {
  const extractMainSubject = (s: string): string => {
    if (s.includes('_')) { const mainPart = s.split('_')[0]; if (['variaveis', 'listas', 'condicionais', 'verificacoes', 'tipos', 'funcoes', 'loops'].includes(mainPart)) { return mainPart; } } return s;
  };
  const mainSubject = extractMainSubject(subject);
  if (mainSubject in this.subjectCountsQuiz) { this.subjectCountsQuiz[mainSubject] += 1; }
  if (
    [
      'textos',
      'caracteres',
      'numeros',
      'operadores_matematicos',
      'operadores_logicos',
      'operadores_ternarios',
      'soma',
      'subtracao',
      'multiplicacao',
      'divisao_inteira',
      'divisao_resto',
      'divisao_normal'

    ].includes(mainSubject) && "tipos" in this.subjectCountsQuiz) { this.subjectCountsQuiz["tipos"] += 1; }
  this.markModified('subjectCountsQuiz');
};

UserAnalysisIISchema.methods.updateSubjectCountsChat = function (subject: string, sessionIndex?: number) {
  const idx = sessionIndex !== undefined ? sessionIndex : this.sessions.length - 1;
  const session = this.sessions[idx];
  if (!session) return;
  if (!session.subjectCountsChat) { session.subjectCountsChat = getEmptySubjectCounts(); }
  if (subject in session.subjectCountsChat) {
    session.subjectCountsChat[subject] += 1;
    this.markModified(`sessions.${idx}.subjectCountsChat`);
  } else {
    console.warn(`[UserAnalysisII Model] Tentativa de incrementar assunto inválido no chat: '${subject}'.`);
  }
};

UserAnalysisIISchema.methods.addAnswerHistory = function (
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
      totalCorrectWrongAnswersSession: { totalCorrectAnswers: 0, totalWrongAnswers: 0 }
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

export const UserAnalysisII = mongoose.model<IUserAnalysisII>(
  "UserAnalysisII",
  UserAnalysisIISchema
);