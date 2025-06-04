"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAnalysis = exports.getEmptySubjectCounts = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// sub-schema para cada questão respondida
const QuestionSchema = new mongoose_1.Schema({
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
const QuizAttemptSchema = new mongoose_1.Schema({
    questions: { type: [QuestionSchema], default: [] },
    totalCorrectWrongAnswersSession: {
        totalCorrectAnswers: { type: Number, default: 0 },
        totalWrongAnswers: { type: Number, default: 0 },
    },
}, { _id: false });
// Lista de todos os assuntos principais disponíveis
const mainSubjects = [
    "variaveis",
    "listas",
    "condicionais",
    "verificacoes",
    "tipos",
    "funcoes",
    "loops"
];
// Assuntos que são subcategorias de "tipos"
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
// Lista completa de todos os assuntos disponíveis
const allSubjects = [...mainSubjects, ...typeSubjects];
// Função para verificar se um assunto é uma subcategoria de tipos
const isTypeSubject = (subject) => typeSubjects.includes(subject);
// Função para extrair o assunto principal de um subassunto (ex: "variaveis_o_que_e" -> "variaveis")
const extractMainSubject = (subject) => {
    if (subject.includes('_')) {
        const mainPart = subject.split('_')[0];
        if (mainSubjects.includes(mainPart) || typeSubjects.includes(mainPart)) {
            return mainPart;
        }
    }
    return subject;
};
// Schema para os objetos de contagem de assuntos
const SubjectCountsSchema = new mongoose_1.Schema({
    variaveis: { type: Number, default: 0 },
    tipos: { type: Number, default: 0 },
    funcoes: { type: Number, default: 0 },
    loops: { type: Number, default: 0 },
    verificacoes: { type: Number, default: 0 },
}, { _id: false });
// Criar função para obter objeto de contagem zerado
const getEmptySubjectCounts = () => ({
    variaveis: 0,
    tipos: 0,
    funcoes: 0,
    loops: 0,
    verificacoes: 0
});
exports.getEmptySubjectCounts = getEmptySubjectCounts;
// sub-schema para cada sessão de uso
const SessionSchema = new mongoose_1.Schema({
    sessionStart: { type: Date, default: Date.now },
    sessionEnd: { type: Date },
    sessionDuration: { type: Number, default: 0 },
    totalCorrectAnswers: { type: Number, default: 0 },
    totalWrongAnswers: { type: Number, default: 0 },
    // Tornando o campo opcional, mas com um default para quando for criado
    subjectCountsChat: {
        type: SubjectCountsSchema,
        default: (0, exports.getEmptySubjectCounts)(),
        required: false // Tornando explicitamente opcional
    },
    answerHistory: { type: [QuizAttemptSchema], default: [] },
}, { _id: false });
const UserAnalysisSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    schoolId: { type: mongoose_1.Schema.Types.ObjectId, ref: "University", required: true },
    schoolName: { type: String, required: true },
    courseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Course", required: true },
    courseName: { type: String, required: true },
    classId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Class", required: true },
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
// auto-populate de schoolId, courseId e classId com seus nomes
UserAnalysisSchema.pre(/^find/, function (next) {
    this.populate("schoolId", "name");
    this.populate("courseId", "name");
    this.populate("classId", "name");
    next();
});
// atualiza sessionDuration antes de salvar
UserAnalysisSchema.pre("save", function (next) {
    const last = this.sessions.at(-1);
    if ((last === null || last === void 0 ? void 0 : last.sessionStart) && (last === null || last === void 0 ? void 0 : last.sessionEnd)) {
        last.sessionDuration =
            (last.sessionEnd.getTime() - last.sessionStart.getTime()) / 1000;
    }
    next();
});
// Método para atualizar o contador de assuntos de quiz no nível do documento
UserAnalysisSchema.methods.updateSubjectCountsQuiz = function (subject) {
    // Extrai o assunto principal do subassunto (se for um subassunto)
    const mainSubject = extractMainSubject(subject);
    // Atualiza o contador do assunto principal no nível do documento
    if (mainSubject in this.subjectCountsQuiz) {
        this.subjectCountsQuiz[mainSubject] += 1;
    }
    // Se for um subtipo de tipos, também incrementa o contador de "tipos"
    if (isTypeSubject(mainSubject) && "tipos" in this.subjectCountsQuiz) {
        this.subjectCountsQuiz["tipos"] += 1;
    }
    // Marca o campo como modificado para garantir que o mongoose salve a mudança
    this.markModified('subjectCountsQuiz');
};
// Método para atualizar o contador de assuntos de chat no nível da sessão
UserAnalysisSchema.methods.updateSubjectCountsChat = function (subject, sessionIndex) {
    // Determina qual sessão atualizar (última por padrão)
    const idx = sessionIndex !== undefined ? sessionIndex : this.sessions.length - 1;
    // Verifica se a sessão existe
    if (!this.sessions[idx])
        return;
    // Extrai o assunto principal do subassunto (se for um subassunto)
    const mainSubject = extractMainSubject(subject);
    // Inicializa o objeto subjectCountsChat se não existir
    if (!this.sessions[idx].subjectCountsChat) {
        this.sessions[idx].subjectCountsChat = (0, exports.getEmptySubjectCounts)();
    }
    // Atualiza o contador do assunto principal no nível da sessão
    if (mainSubject in this.sessions[idx].subjectCountsChat) {
        this.sessions[idx].subjectCountsChat[mainSubject] += 1;
    }
    // Se for um subtipo de tipos, também incrementa o contador de "tipos"
    if (isTypeSubject(mainSubject) && "tipos" in this.sessions[idx].subjectCountsChat) {
        this.sessions[idx].subjectCountsChat["tipos"] += 1;
    }
    // Marca o campo como modificado para garantir que o mongoose salve a mudança
    this.markModified(`sessions.${idx}.subjectCountsChat`);
};
// método para registrar histórico de respostas
UserAnalysisSchema.methods.addAnswerHistory = function (level, question, subject, selectedOption, isCorrect) {
    const last = this.sessions.at(-1);
    if (!last || last.sessionEnd)
        return;
    // cria uma nova tentativa de quiz se necessário
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
    // atualiza contadores gerais da sessão de quiz
    attempt.totalCorrectWrongAnswersSession.totalCorrectAnswers += correctCount;
    attempt.totalCorrectWrongAnswersSession.totalWrongAnswers += wrongCount;
};
exports.UserAnalysis = mongoose_1.default.model("UserAnalysis", UserAnalysisSchema);
