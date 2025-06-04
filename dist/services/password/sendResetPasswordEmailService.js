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
exports.SendResetPasswordEmailService = void 0;
const nodemailerTransport_1 = require("../../config/resetPassword/nodemailerTransport");
const mailOptions_1 = require("../../config/resetPassword/mailOptions");
const generateResetToken_1 = require("../../config/resetPassword/generateResetToken");
class SendResetPasswordEmailService {
    sendEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const generateResetTokenService = new generateResetToken_1.GenerateResetToken();
            const { resetLink } = yield generateResetTokenService.execute(email);
            const senderEmail = process.env.SMTP_EMAIL;
            const senderPassword = process.env.SMTP_PASSWORD;
            const domain = process.env.SMTP_DOMAIN;
            const port = Number(process.env.SMTP_PORT) || 587;
            const transporter = (0, nodemailerTransport_1.createTransporter)(senderEmail, senderPassword, domain, port);
            const options = (0, mailOptions_1.mailOptions)(senderEmail, email, "Redefinição de Senha", `Olá,\n\nAcesse o seguinte link para redefinir sua senha:\n\n${resetLink}\n\nSe você não solicitou essa redefinição, ignore este e-mail.`);
            yield transporter.sendMail(options);
            return { resetLink };
        });
    }
}
exports.SendResetPasswordEmailService = SendResetPasswordEmailService;
