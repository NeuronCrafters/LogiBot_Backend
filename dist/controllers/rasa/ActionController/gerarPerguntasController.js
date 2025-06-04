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
exports.gerarPerguntasController = gerarPerguntasController;
const sessionMemory_1 = require("../../../services/rasa/types/sessionMemory");
const gerarPerguntasService_1 = require("../../../services/rasa/ActionService/gerarPerguntasService");
function gerarPerguntasController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = req.user.id;
            const { pergunta } = req.body;
            if (!pergunta) {
                return res.status(400).json({ message: "A pergunta é obrigatória." });
            }
            const session = (0, sessionMemory_1.getSession)(userId);
            // Chamada ao service
            const { perguntas, gabarito, nivel, assunto } = yield (0, gerarPerguntasService_1.gerarPerguntasService)(pergunta, session);
            // Atualiza a sessão
            session.lastQuestions = perguntas.map((p) => p.question);
            session.lastAnswerKeys = gabarito;
            session.lastSubject = assunto;
            session.nivelAtual = nivel;
            return res.status(200).json({ questions: perguntas });
        }
        catch (error) {
            console.error("❌ Erro ao gerar perguntas:", error);
            return res.status(500).json({
                message: "Erro ao gerar perguntas",
                error: error.message || "Erro interno",
            });
        }
    });
}
