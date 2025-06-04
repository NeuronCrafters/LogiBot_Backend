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
exports.listarNiveisController = listarNiveisController;
const listarNiveisService_1 = require("../../../services/rasa/ActionService/listarNiveisService");
function listarNiveisController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield (0, listarNiveisService_1.listarNiveisService)();
            res.status(200).json(result);
        }
        catch (error) {
            res.status(500).json({ message: "Erro ao obter os níveis", error: error.message });
        }
    });
}
