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
exports.CreateUserController = void 0;
const CreateUserService_1 = require("../../services/users/CreateUserService");
class CreateUserController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { name, email, password, code } = req.body;
                if (!name || !email || !password || !code) {
                    return res.status(400).json({
                        message: "Os campos name, email, password e disciplineCode são obrigatórios.",
                    });
                }
                const createUserService = new CreateUserService_1.CreateUserService();
                const user = yield createUserService.createUser({
                    name,
                    email,
                    password,
                    code,
                });
                return res.status(201).json({
                    message: "Usuário criado com sucesso!",
                    user,
                });
            }
            catch (error) {
                console.error("Erro ao criar usuário:", error.message);
                return res.status(error.statusCode || 500).json({
                    message: error.message || "Erro inesperado!",
                });
            }
        });
    }
}
exports.CreateUserController = CreateUserController;
