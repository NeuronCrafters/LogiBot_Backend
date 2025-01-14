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
exports.RasaController = void 0;
const rasaService_1 = require("../../services/rasa/rasaService");
class RasaController {
    constructor() {
        this.rasaService = new rasaService_1.RasaService();
    }
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { sender, message } = req.body;
            if (!sender || !message) {
                return res.status(400).json({ error: "Sender and message are required" });
            }
            try {
                const responseFromRasa = yield this.rasaService.sendMessageToSAEL({
                    sender,
                    message,
                });
                return res.json(responseFromRasa);
            }
            catch (error) {
                return res.status(500).json({ error: "Error connecting to Rasa" });
            }
        });
    }
}
exports.RasaController = RasaController;
