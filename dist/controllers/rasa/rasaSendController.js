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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RasaSendController = void 0;
const rasaSendService_1 = require("../../services/rasa/rasaSendService");
const UserAnalysis_1 = require("../../models/UserAnalysis");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const AppError_1 = require("../../exceptions/AppError");
class RasaSendController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const authHeader = req.headers.authorization;
                if (!authHeader) {
                    throw new AppError_1.AppError("Token não fornecido.", 401);
                }
                const token = authHeader.split(" ")[1];
                if (!token) {
                    throw new AppError_1.AppError("Token inválido.", 401);
                }
                let userId;
                try {
                    const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                    if (!decoded.id) {
                        throw new AppError_1.AppError("Token inválido ou expirado.", 401);
                    }
                    userId = decoded.id;
                }
                catch (error) {
                    throw new AppError_1.AppError("Token inválido ou expirado.", 401);
                }
                console.log(`[DEBUG] Usuário autenticado: ${userId}`);
                const { message } = req.body;
                if (!message) {
                    throw new AppError_1.AppError("O campo 'message' é obrigatório.", 400);
                }
                console.log(`[DEBUG] Enviando mensagem para Rasa: ${message}`);
                const response = yield (0, rasaSendService_1.rasaSendService)(message, userId);
                console.log(`[DEBUG] Resposta do Rasa recebida: ${JSON.stringify(response)}`);
                const botResponse = response.length ? response[0].text : "Não foi possível processar sua mensagem.";
                const userAnalysis = yield UserAnalysis_1.UserAnalysis.findOne({ userId });
                if (!userAnalysis || userAnalysis.sessions.length === 0) {
                    throw new AppError_1.AppError("Nenhuma sessão ativa encontrada para este usuário.", 404);
                }
                const lastSession = userAnalysis.sessions[userAnalysis.sessions.length - 1];
                if (lastSession.sessionEnd) {
                    throw new AppError_1.AppError("A sessão do usuário já foi encerrada.", 400);
                }
                lastSession.answerHistory.push({
                    questions: [],
                    totalCorrectWrongAnswersSession: {
                        totalCorrectAnswers: 0,
                        totalWrongAnswers: 0
                    }
                });
                yield userAnalysis.save();
                console.log(`[UserAnalysis] Interação registrada para usuário: ${userId}`);
                return res.json(response);
            }
            catch (error) {
                console.error("[RasaControllerSend] Erro ao processar interação:", error);
                return res.status(error.statusCode || 500).json({ error: error.message || "Erro interno no servidor." });
            }
        });
    }
}
exports.RasaSendController = RasaSendController;
