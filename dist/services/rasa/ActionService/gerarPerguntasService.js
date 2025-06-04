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
exports.gerarPerguntasService = gerarPerguntasService;
const axios_1 = __importDefault(require("axios"));
const AppError_1 = require("../../../exceptions/AppError");
const parseQuestionsFromTextService_1 = require("./parseQuestionsFromTextService");
const RASA_ACTION_URL = process.env.RASA_ACTION;
function gerarPerguntasService(pergunta, session) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        if (!session.nivelAtual) {
            throw new AppError_1.AppError("O nível do usuário precisa ser definido antes de gerar perguntas.", 400);
        }
        session.lastSubject = pergunta;
        try {
            const response = yield axios_1.default.post(RASA_ACTION_URL, {
                next_action: "action_gerar_perguntas_chatgpt",
                tracker: {
                    sender_id: "user",
                    slots: {
                        subtopico: pergunta,
                        nivel: session.nivelAtual,
                    },
                },
            });
            if (!((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.responses) === null || _b === void 0 ? void 0 : _b.length)) {
                throw new AppError_1.AppError("Resposta do Rasa não contém texto válido.", 500);
            }
            const rawText = (_c = response.data.responses[0]) === null || _c === void 0 ? void 0 : _c.text;
            if (!rawText) {
                throw new AppError_1.AppError("Resposta do Rasa não contém texto.", 500);
            }
            let jsonData;
            try {
                jsonData = JSON.parse(rawText);
            }
            catch (_f) {
                jsonData = (0, parseQuestionsFromTextService_1.parseQuestionsFromTextService)(rawText);
            }
            if (!Array.isArray(jsonData.questions) || jsonData.questions.length !== 5) {
                throw new AppError_1.AppError("Formato inesperado de perguntas na resposta.", 500);
            }
            const gabarito = ((_e = (_d = response.data.responses[0]) === null || _d === void 0 ? void 0 : _d.custom) === null || _e === void 0 ? void 0 : _e.answer_keys) || [];
            session.lastQuestions = jsonData.questions.map((q) => q.question);
            session.lastAnswerKeys = gabarito;
            return {
                perguntas: jsonData.questions,
                gabarito,
                nivel: session.nivelAtual,
                assunto: pergunta,
            };
        }
        catch (error) {
            console.error("gerarPerguntasService falhou:", error);
            if (error instanceof AppError_1.AppError)
                throw error;
            throw new AppError_1.AppError(error.message || "Erro ao gerar perguntas", 500);
        }
    });
}
