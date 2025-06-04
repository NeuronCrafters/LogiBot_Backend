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
exports.ResetPasswordController = void 0;
const resetPasswordService_1 = require("../../services/password/resetPasswordService");
class ResetPasswordController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { token, newPassword } = req.body;
            try {
                const service = new resetPasswordService_1.ResetPasswordService();
                yield service.resetPassword(token, newPassword);
                return res.status(200).json({ message: "Senha redefinida com sucesso." });
            }
            catch (error) {
                return res.status(400).json({ error: error.message });
            }
        });
    }
}
exports.ResetPasswordController = ResetPasswordController;
