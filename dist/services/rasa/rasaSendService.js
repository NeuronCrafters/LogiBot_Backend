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
exports.rasaSendService = rasaSendService;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const rasa_send = process.env.RASA;
if (!rasa_send) {
    console.error("Variável de ambiente RASA não definida.");
}
function rasaSendService(message, sender) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!sender) {
            throw new Error("Sender (usuário) não pode ser indefinido.");
        }
        try {
            const response = yield axios_1.default.post(rasa_send, { sender, message });
            if (!response.data || response.data.length === 0) {
                console.warn("[RasaServiceSend] Nenhuma resposta do Rasa.");
                return [{ text: "Desculpe, não entendi sua pergunta." }];
            }
            return response.data;
        }
        catch (error) {
            if (error.response) {
                console.error("[RasaServiceSend] Erro ao conectar ao Rasa. Status:", error.response.status, "Dados:", error.response.data);
            }
            else {
                console.error("[RasaServiceSend] Erro ao conectar ao Rasa:", error.message);
            }
            throw new Error("Falha ao se comunicar com o Rasa.");
        }
    });
}
