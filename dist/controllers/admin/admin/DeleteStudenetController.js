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
exports.deleteStudentController = deleteStudentController;
const DeleteStudenetService_1 = require("../../../services/admin/admin/DeleteStudenetService");
function deleteStudentController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { studentId } = req.query;
            if (!studentId || typeof studentId !== 'string') {
                return res.status(400).json({
                    error: "ID do estudante é obrigatório e deve ser uma string"
                });
            }
            const result = yield (0, DeleteStudenetService_1.adminDeleteStudentService)(studentId);
            if (!result.success) {
                return res.status(404).json({
                    error: result.message
                });
            }
            return res.status(200).json({
                message: "Estudante deletado com sucesso",
                data: result.data
            });
        }
        catch (error) {
            console.error("Erro no controller de deletar estudante:", error);
            return res.status(500).json({
                error: "Erro interno do servidor ao deletar estudante"
            });
        }
    });
}
