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
exports.UpdatePasswordController = void 0;
const updatePasswordService_1 = require("../../services/password/updatePasswordService");
class UpdatePasswordController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { currentPassword, newPassword } = req.body;
            try {
                if (!currentPassword || !newPassword) {
                    throw new Error("Os campos 'currentPassword' e 'newPassword' são obrigatórios.");
                }
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                const roles = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
                if (!userId || !roles) {
                    throw new Error("Informações do usuário ausentes no token.");
                }
                const allowedRoles = ["professor", "student", "admin"];
                const role = roles.find((r) => allowedRoles.includes(r));
                if (!role) {
                    throw new Error("Papel inválido.");
                }
                const service = new updatePasswordService_1.UpdatePasswordService();
                yield service.updatePassword(userId, currentPassword, newPassword, role);
                return res.status(200).json({ message: "Senha atualizada com sucesso." });
            }
            catch (error) {
                return res.status(400).json({ error: error.message });
            }
        });
    }
}
exports.UpdatePasswordController = UpdatePasswordController;
