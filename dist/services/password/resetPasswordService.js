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
exports.ResetPasswordService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const findUserByEmail_1 = require("../../config/resetPassword/findUserByEmail");
class ResetPasswordService {
    resetPassword(token, newPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            const secret = process.env.JWT_SECRET || "default_secret";
            try {
                const decoded = jsonwebtoken_1.default.verify(token, secret);
                const user = yield (0, findUserByEmail_1.findUserByEmail)(decoded.id);
                if (!user || user.resetPasswordToken !== token || user.resetPasswordExpires <= new Date()) {
                    throw new Error("Token inválido ou expirado.");
                }
                const isSamePassword = yield bcryptjs_1.default.compare(newPassword, user.password || "");
                if (isSamePassword) {
                    throw new Error("A nova senha não pode ser igual à senha anterior.");
                }
                user.password = yield bcryptjs_1.default.hash(newPassword, 10);
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;
                yield user.save();
            }
            catch (error) {
                throw new Error("Falha ao redefinir senha. Verifique o token.");
            }
        });
    }
}
exports.ResetPasswordService = ResetPasswordService;
