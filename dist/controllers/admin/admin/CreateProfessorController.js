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
exports.CreateProfessorController = void 0;
const CreateProfessorService_1 = require("../../../services/admin/admin/CreateProfessorService");
class CreateProfessorController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { name, email, password, school, courses } = req.body;
            const createProfessorService = new CreateProfessorService_1.CreateProfessorService();
            try {
                const professor = yield createProfessorService.execute({
                    name,
                    email,
                    password,
                    school,
                    courses,
                });
                return res.status(201).json(professor);
            }
            catch (error) {
                console.error("Erro ao criar professor:", error);
                return res.status(error.statusCode || 500).json({
                    error: error.message || "Erro interno ao criar professor",
                });
            }
        });
    }
}
exports.CreateProfessorController = CreateProfessorController;
