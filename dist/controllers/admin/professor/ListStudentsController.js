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
exports.ListStudentsController = void 0;
const ListStudentsService_1 = require("../../../services/admin/professor/ListStudentsService");
const AppError_1 = require("../../../exceptions/AppError");
class ListStudentsController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const requesterId = String((_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
                const requesterRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
                if (!requesterId || !requesterRole) {
                    throw new AppError_1.AppError("Usuário não autenticado ou sem papel definido.", 401);
                }
                const service = new ListStudentsService_1.ListStudentsService();
                const students = yield service.execute({
                    requesterId,
                    requesterRole,
                });
                return res.status(200).json(students);
            }
            catch (error) {
                console.error("Erro no controller de listagem de alunos:", error);
                const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
                const message = error instanceof AppError_1.AppError ? error.message : "Erro interno ao listar alunos.";
                return res.status(status).json({ error: message });
            }
        });
    }
}
exports.ListStudentsController = ListStudentsController;
