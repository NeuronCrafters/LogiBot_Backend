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
exports.GenerateResetToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const findUserByEmail_1 = require("../../config/resetPassword/findUserByEmail");
class GenerateResetToken {
    execute(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const secret = process.env.JWT_SECRET || "default_secret";
            const user = yield (0, findUserByEmail_1.findUserByEmail)(email);
            if (!user) {
                throw new Error("Usuário não encontrado.");
            }
            // if (user.resetPasswordExpires && user.resetPasswordExpires > new Date()) {
            //   throw new Error("Aguarde 2 horas antes de solicitar outro e-mail de redefinição.");
            // }
            const token = jsonwebtoken_1.default.sign({ id: user._id }, secret, { expiresIn: "1h" });
            user.resetPasswordToken = token;
            user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hora
            yield user.save();
            const resetLink = `${process.env.FRONTEND_URL}?token=${token}`;
            return { token, resetLink };
        });
    }
}
exports.GenerateResetToken = GenerateResetToken;
