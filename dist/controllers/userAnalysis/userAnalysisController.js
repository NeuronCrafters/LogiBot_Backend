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
exports.addInteraction = addInteraction;
const userAnalysisService_1 = require("../../services/userAnalysis/userAnalysisService");
function addInteraction(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { message } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({ error: "Usuário não autenticado" });
        }
        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({ error: "Campo 'message' é obrigatório" });
        }
        try {
            yield (0, userAnalysisService_1.recordInteraction)(userId, message.trim());
            return res.status(200).json({ success: true });
        }
        catch (err) {
            console.error("Erro em recordInteraction:", err);
            return res.status(500).json({ error: err.message || "Erro interno" });
        }
    });
}
