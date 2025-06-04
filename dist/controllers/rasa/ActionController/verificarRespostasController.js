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
exports.verificarRespostasController = verificarRespostasController;
const verificarRespostasService_1 = require("../../../services/rasa/ActionService/verificarRespostasService");
const sessionMemory_1 = require("../../../services/rasa/types/sessionMemory");
const UserAnalysis_1 = require("../../../models/UserAnalysis");
const AppError_1 = require("../../../exceptions/AppError");
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
function verificarRespostasController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const { respostas } = req.body;
            // Verifica se as respostas são um array
            if (!Array.isArray(respostas)) {
                return res.status(400).json({
                    message: "As respostas são obrigatórias e devem estar em um array.",
                });
            }
            const userId = req.user.id;
            const email = req.user.email;
            const role = req.user.role;
            // Obtém a sessão atual do usuário
            const session = (0, sessionMemory_1.getSession)(userId);
            // Verifica se a sessão tem perguntas e gabarito
            if (!((_a = session === null || session === void 0 ? void 0 : session.lastAnswerKeys) === null || _a === void 0 ? void 0 : _a.length) || !((_b = session === null || session === void 0 ? void 0 : session.lastQuestions) === null || _b === void 0 ? void 0 : _b.length)) {
                return res.status(400).json({
                    message: "Sessão inválida: perguntas ou gabarito ausentes.",
                });
            }
            // Garante que o UserAnalysis exista
            let ua = yield UserAnalysis_1.UserAnalysis.findOne({ userId, email }).exec();
            if (!ua) {
                return res.status(404).json({
                    message: "Usuário não encontrado.",
                });
            }
            // Validação extra: Garante que o array de sessões exista
            if (!ua.sessions) {
                ua.sessions = [];
            }
            // Verificar se precisamos criar uma nova sessão
            const needsNewSession = ua.sessions.length === 0 ||
                (ua.sessions[ua.sessions.length - 1].sessionEnd !== undefined);
            if (needsNewSession) {
                console.log("Criando nova sessão para o usuário", userId);
                // Criar nova sessão com subjectCountsChat inicializado corretamente
                ua.sessions.push({
                    sessionStart: new Date(),
                    totalCorrectAnswers: 0,
                    totalWrongAnswers: 0,
                    subjectCountsChat: {
                        variaveis: 0,
                        tipos: 0,
                        funcoes: 0,
                        loops: 0,
                        verificacoes: 0
                    },
                    answerHistory: []
                });
                // É importante salvar aqui para criar a nova sessão antes de continuar
                yield ua.save();
                // Recarregar o usuário para garantir que temos a versão mais recente
                ua = yield UserAnalysis_1.UserAnalysis.findOne({ userId, email }).exec();
                if (!ua) {
                    throw new AppError_1.AppError("Erro ao recarregar dados do usuário após criar sessão", 500);
                }
            }
            // Chama o serviço para verificar as respostas e atualizar o UserAnalysis
            const result = yield (0, verificarRespostasService_1.verificarRespostasService)(respostas, userId, email, session, role);
            // Retorna o resultado da verificação
            return res.status(200).json(result);
        }
        catch (error) {
            // Se for um erro da nossa classe AppError, retorna o erro com o status adequado
            if (error instanceof AppError_1.AppError) {
                return res.status(error.statusCode).json({
                    message: error.message,
                });
            }
            // Log de erro inesperado
            console.error("Erro no controller de verificação de respostas:", error);
            // Retorna um erro genérico para falhas internas do servidor
            return res.status(500).json({
                message: error.message || "Erro ao verificar respostas",
            });
        }
    });
}
