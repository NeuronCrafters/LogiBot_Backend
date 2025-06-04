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
exports.SendResetPasswordEmailController = void 0;
const sendResetPasswordEmailService_1 = require("../../services/password/sendResetPasswordEmailService");
class SendResetPasswordEmailController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { email } = req.body;
            try {
                if (!email) {
                    throw new Error("O campo 'email' é obrigatório.");
                }
                const service = new sendResetPasswordEmailService_1.SendResetPasswordEmailService();
                const { resetLink } = yield service.sendEmail(email);
                return res.status(200).json({
                    message: "E-mail de redefinição enviado com sucesso.",
                    resetLink,
                });
            }
            catch (error) {
                return res.status(400).json({ error: error.message });
            }
        });
    }
}
exports.SendResetPasswordEmailController = SendResetPasswordEmailController;
