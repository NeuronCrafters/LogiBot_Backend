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
exports.conversarController = conversarController;
const conversarService_1 = require("../../../services/rasa/ActionChat/conversarService");
function conversarController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const data = yield (0, conversarService_1.conversarService)();
            // extrai a resposta de texto (ajuste conforme o shape real do Rasa)
            const text = Array.isArray(data.messages) && ((_a = data.messages[0]) === null || _a === void 0 ? void 0 : _a.text)
                ? data.messages[0].text
                : // ou se vem em data.text
                    data.text ||
                        // fallback
                        "Desculpe, não entendi.";
            return res.json({ responses: [{ text }] });
        }
        catch (error) {
            console.error("Erro no conversarController:", error);
            return res.json({
                responses: [
                    {
                        text: "Desculpe, ocorreu um problema ao conversar com o bot. Tente novamente mais tarde.",
                    },
                ],
            });
        }
    });
}
