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
exports.UpdateProfessorRoleController = void 0;
const UpdateProfessorRoleService_1 = require("../../../services/admin/admin/UpdateProfessorRoleService");
const AppError_1 = require("../../../exceptions/AppError");
class UpdateProfessorRoleController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { id } = req.params;
            const { action } = req.body;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            const userRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
            if (!["add", "remove"].includes(action)) {
                throw new AppError_1.AppError("Ação inválida. Use 'add' ou 'remove'.", 400);
            }
            if (!userId || !userRole.includes("admin")) {
                throw new AppError_1.AppError("Acesso negado. Apenas administradores podem alterar o cargo.", 403);
            }
            if (userId === id) {
                throw new AppError_1.AppError("Você não pode alterar seu próprio cargo.", 403);
            }
            const service = new UpdateProfessorRoleService_1.UpdateProfessorRoleService();
            const updatedProfessor = yield service.execute(id, action);
            return res.status(200).json(updatedProfessor);
        });
    }
}
exports.UpdateProfessorRoleController = UpdateProfessorRoleController;
