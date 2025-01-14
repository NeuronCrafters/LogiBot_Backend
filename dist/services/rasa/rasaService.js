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
exports.RasaService = void 0;
const axios_1 = __importDefault(require("axios"));
const AppError_1 = require("../../exceptions/AppError");
class RasaService {
    constructor() {
        this.rasaUrl = process.env.RASA_URL || "http://localhost:5005/webhooks/rest/webhook";
    }
    sendMessageToSAEL(_a) {
        return __awaiter(this, arguments, void 0, function* ({ sender, message }) {
            try {
                const response = yield axios_1.default.post(this.rasaUrl, {
                    sender,
                    message,
                });
                if (!response.data || response.data.length === 0) {
                    throw new AppError_1.AppError("Nenhuma resposta do Rasa", 502);
                }
                return response.data;
            }
            catch (error) {
                if (error.response) {
                    throw new AppError_1.AppError(`Erro do Rasa: ${error.response.data.message}`, error.response.status);
                }
                else if (error.request) {
                    throw new AppError_1.AppError("Falha na comunicação com o Rasa", 503);
                }
                else {
                    throw new AppError_1.AppError("Erro ao processar mensagem no Rasa", 500);
                }
            }
        });
    }
}
exports.RasaService = RasaService;
