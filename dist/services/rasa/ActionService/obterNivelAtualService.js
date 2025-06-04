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
exports.obterNivelAtualService = obterNivelAtualService;
const axios_1 = __importDefault(require("axios"));
const RASA_ACTION_URL = process.env.RASA_ACTION;
function obterNivelAtualService() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.post(RASA_ACTION_URL, {
                next_action: "action_obter_nivel",
                tracker: { sender_id: "user" },
            });
            if (!response.data || !response.data.nivel) {
                return null;
            }
            return response.data.nivel;
        }
        catch (error) {
            return null;
        }
    });
}
