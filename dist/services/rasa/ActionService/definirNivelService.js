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
exports.definirNivelService = definirNivelService;
const axios_1 = __importDefault(require("axios"));
const AppError_1 = require("../../../exceptions/AppError");
const RASA_ACTION_URL = process.env.RASA_ACTION;
function definirNivelService(nivel) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.post(RASA_ACTION_URL, {
                next_action: "action_definir_nivel",
                tracker: {
                    sender_id: "user",
                    slots: { nivel },
                },
            });
            return response.data;
        }
        catch (error) {
            throw new AppError_1.AppError("Erro ao definir o nível", 500);
        }
    });
}
