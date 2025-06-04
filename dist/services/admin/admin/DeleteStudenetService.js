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
exports.adminDeleteStudentService = adminDeleteStudentService;
const User_1 = require("../../../models/User");
const mongoose_1 = __importDefault(require("mongoose"));
function adminDeleteStudentService(studentId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Validar se o ID é um ObjectId válido
            if (!mongoose_1.default.Types.ObjectId.isValid(studentId)) {
                return {
                    success: false,
                    message: "ID do estudante inválido"
                };
            }
            // Buscar o estudante
            const student = yield User_1.User.findById(studentId);
            if (!student) {
                return {
                    success: false,
                    message: "Estudante não encontrado"
                };
            }
            // Verificar se o usuário é realmente um estudante
            if (!student.role.includes("student")) {
                return {
                    success: false,
                    message: "Usuário não é um estudante"
                };
            }
            // Deletar o estudante
            const deletedStudent = yield User_1.User.findByIdAndDelete(studentId);
            if (!deletedStudent) {
                return {
                    success: false,
                    message: "Erro ao deletar estudante"
                };
            }
            return {
                success: true,
                message: "Estudante deletado com sucesso",
                data: {
                    id: deletedStudent._id,
                    name: deletedStudent.name,
                    email: deletedStudent.email
                }
            };
        }
        catch (error) {
            console.error("Erro no service de deletar estudante:", error);
            return {
                success: false,
                message: "Erro interno ao deletar estudante"
            };
        }
    });
}
