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
exports.getGabaritoController = getGabaritoController;
const getGabaritoService_1 = require("../../../services/rasa/ActionService/getGabaritoService");
const sessionMemory_1 = require("../../../services/rasa/types/sessionMemory");
function getGabaritoController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = req.user.id;
            const session = (0, sessionMemory_1.getSession)(userId);
            const result = (0, getGabaritoService_1.getGabaritoService)(session);
            res.status(200).json(result);
        }
        catch (error) {
            res.status(500).json({ message: "Erro ao obter o gabarito", error: error.message });
        }
    });
}
