"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verificarRespostasService = verificarRespostasService;
const AppError_1 = require("../../../exceptions/AppError");
const UserAnalysis_1 = require("../../../models/UserAnalysis");
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
const isTypeSubject = (subject) => typeSubjects.includes(subject);
const extractMainSubject = (subject) => {
    if (subject.includes('_')) {
        const mainPart = subject.split('_')[0];
        if (mainSubjects.includes(mainPart) || typeSubjects.includes(mainPart)) {
            return mainPart;
        }
    }
    return subject;
};
function verificarRespostasService(respostas, userId, email, session, role) {
    return __awaiter(this, void 0, void 0, function* () {
        // Validação inicial dos dados de sessão
        if (!session.lastAnswerKeys || !session.lastQuestions ||
            session.lastAnswerKeys.length === 0 || session.lastQuestions.length === 0) {
            throw new AppError_1.AppError("Gabarito ou perguntas não definidos.", 400);
        }
        if (respostas.length !== session.lastAnswerKeys.length) {
            throw new AppError_1.AppError("Número de respostas não corresponde ao número de perguntas.", 400);
        }
        const normalizeOption = (value) => value.replace(/options\s*/i, "").trim().toLowerCase().replace(/\s+/g, "");
        let acertos = 0;
        let erros = 0;
        const isStudent = Array.isArray(role) ? role.includes("student") : role === "student";
        if (!isStudent) {
            const detalhes = session.lastQuestions.map((question, idx) => {
                const resposta = respostas[idx];
                const gabarito = session.lastAnswerKeys[idx];
                const certo = normalizeOption(resposta) === normalizeOption(gabarito);
                if (certo)
                    acertos++;
                else
                    erros++;
                return {
                    level: session.nivelAtual || "Nível desconhecido",
                    subject: session.lastSubject || "Assunto desconhecido",
                    selectedOption: {
                        question,
                        isCorrect: certo ? "true" : "false",
                        isSelected: resposta,
                    },
                    totalCorrectAnswers: certo ? 1 : 0,
                    totalWrongAnswers: certo ? 0 : 1,
                    timestamp: new Date(),
                };
            });
            return {
                message: acertos === respostas.length
                    ? "🎉 Parabéns! Acertou todas!"
                    : "⚠️ Confira seu resultado:",
                totalCorrectAnswers: acertos,
                totalWrongAnswers: erros,
                detalhes: { questions: detalhes },
            };
        }
        const ua = yield UserAnalysis_1.UserAnalysis.findOne({ userId, email })
            .populate("schoolId", "name")
            .populate("courseId", "name")
            .populate("classId", "name")
            .exec();
        if (!ua) {
            throw new AppError_1.AppError("Usuário não encontrado.", 404);
        }
        if (ua.sessions.length === 0 || ua.sessions[ua.sessions.length - 1].sessionEnd) {
            ua.sessions.push({
                sessionStart: new Date(),
                totalCorrectAnswers: 0,
                totalWrongAnswers: 0,
                answerHistory: []
            });
        }
        const lastSessionIndex = ua.sessions.length - 1;
        const newAttempt = {
            questions: [],
            totalCorrectWrongAnswersSession: {
                totalCorrectAnswers: 0,
                totalWrongAnswers: 0
            }
        };
        if (!ua.sessions[lastSessionIndex].answerHistory) {
            ua.sessions[lastSessionIndex].answerHistory = [];
        }
        ua.sessions[lastSessionIndex].answerHistory.push(newAttempt);
        const newAttemptIndex = ua.sessions[lastSessionIndex].answerHistory.length - 1;
        if (session.lastSubject) {
            ua.updateSubjectCountsQuiz(session.lastSubject);
        }
        for (let i = 0; i < respostas.length; i++) {
            const resposta = respostas[i];
            const gabarito = session.lastAnswerKeys[i];
            const pergunta = session.lastQuestions[i];
            const certo = normalizeOption(resposta) === normalizeOption(gabarito);
            if (certo)
                acertos++;
            else
                erros++;
            const question = {
                level: session.nivelAtual || "Nível desconhecido",
                subject: session.lastSubject || "Assunto desconhecido",
                selectedOption: {
                    question: pergunta || "Pergunta desconhecida",
                    isCorrect: certo,
                    isSelected: resposta || "",
                },
                totalCorrectAnswers: certo ? 1 : 0,
                totalWrongAnswers: certo ? 0 : 1,
                timestamp: new Date(),
            };
            ua.sessions[lastSessionIndex].answerHistory[newAttemptIndex].questions.push(question);
            if (certo) {
                ua.sessions[lastSessionIndex].answerHistory[newAttemptIndex].totalCorrectWrongAnswersSession.totalCorrectAnswers += 1;
            }
            else {
                ua.sessions[lastSessionIndex].answerHistory[newAttemptIndex].totalCorrectWrongAnswersSession.totalWrongAnswers += 1;
            }
        }
        ua.totalCorrectWrongAnswers.totalCorrectAnswers += acertos;
        ua.totalCorrectWrongAnswers.totalWrongAnswers += erros;
        ua.sessions[lastSessionIndex].totalCorrectAnswers += acertos;
        ua.sessions[lastSessionIndex].totalWrongAnswers += erros;
        ua.markModified(`sessions.${lastSessionIndex}.answerHistory`);
        ua.markModified(`subjectCountsQuiz`);
        try {
            yield ua.save();
        }
        catch (err) {
            console.error("Erro ao salvar respostas:", err);
            throw new AppError_1.AppError("Erro ao salvar as respostas: " + err.message, 500);
        }
        return {
            message: acertos === respostas.length
                ? "🎉 Parabéns! Acertou todas!"
                : "⚠️ Confira seu resultado:",
            totalCorrectAnswers: acertos,
            totalWrongAnswers: erros,
            detalhes: {
                questions: ua.sessions[lastSessionIndex].answerHistory[newAttemptIndex].questions,
            },
        };
    });
}
