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
exports.actionPerguntarController = actionPerguntarController;
const perguntarService_1 = require("../../../services/rasa/ActionChat/perguntarService");
const UserAnalysis_1 = require("../../../models/UserAnalysis");
const normalizeSubject_1 = require("../../../utils/normalizeSubject");
function actionPerguntarController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const { message } = req.body;
        const senderId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || "user";
        if (!message) {
            return res.status(400).json({ error: "Texto da mensagem é obrigatório." });
        }
        try {
            const response = yield (0, perguntarService_1.actionPerguntarService)(message, senderId);
            const botResponse = ((_c = (_b = response === null || response === void 0 ? void 0 : response.responses) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.text) || "";
            const userAnalysis = yield UserAnalysis_1.UserAnalysis.findOne({ userId: senderId });
            const lastSession = userAnalysis === null || userAnalysis === void 0 ? void 0 : userAnalysis.sessions.at(-1);
            if (userAnalysis && lastSession && !lastSession.sessionEnd) {
                const subject = (0, normalizeSubject_1.normalizeSubjectFromMessage)(message);
            }
            res.status(200).json(response);
        }
        catch (error) {
            console.error("Erro ao conversar com o assistente:", error);
            res.status(500).json({ message: "Erro ao conversar com o assistente", error: error.message });
        }
    });
}
