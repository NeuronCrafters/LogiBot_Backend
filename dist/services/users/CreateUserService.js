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
exports.CreateUserService = void 0;
const bcryptjs_1 = require("bcryptjs");
const AppError_1 = require("../../exceptions/AppError");
const User_1 = require("../../models/User");
const Professor_1 = require("../../models/Professor");
const mongoose_1 = require("mongoose");
class CreateUserService {
    createUser(_a) {
        return __awaiter(this, arguments, void 0, function* ({ name, email, password, role = "student", school }) {
            try {
                const userExists = yield User_1.User.findOne({ email });
                const professorExists = yield Professor_1.Professor.findOne({ email });
                if (userExists || professorExists) {
                    throw new AppError_1.AppError("Email já está em uso por outro usuário!", 409);
                }
                if (!email || !password) {
                    throw new AppError_1.AppError("Email e senha são obrigatórios!", 400);
                }
                const passwordHash = yield (0, bcryptjs_1.hash)(password, 10);
                if (role === "professor") {
                    const newProfessor = yield Professor_1.Professor.create({
                        name,
                        email,
                        password: passwordHash,
                        role: "professor",
                        school,
                    });
                    return {
                        id: newProfessor._id,
                        name: newProfessor.name,
                        email: newProfessor.email,
                        role: newProfessor.role,
                        school: newProfessor.school,
                    };
                }
                if (role === "student") {
                    const professor = yield Professor_1.Professor.findOne({ school });
                    if (!professor) {
                        throw new AppError_1.AppError("Nenhum professor encontrado para esta escola.", 404);
                    }
                    const newStudent = yield User_1.User.create({
                        name,
                        email,
                        password: passwordHash,
                        role: "student",
                        school,
                    });
                    professor.students.push(new mongoose_1.Types.ObjectId(newStudent._id));
                    yield professor.save();
                    return {
                        id: newStudent._id,
                        name: newStudent.name,
                        email: newStudent.email,
                        role: newStudent.role,
                        school: newStudent.school,
                        professor: {
                            id: professor._id,
                            name: professor.name,
                        },
                    };
                }
                // Lógica para criação de admins
                // if (role === "admin") {
                //   const newAdmin = await User.create({
                //     name,
                //     email,
                //     password: passwordHash,
                //     role: "admin",
                //     school,
                //   });
                //   return {
                //     id: newAdmin._id,
                //     name: newAdmin.name,
                //     email: newAdmin.email,
                //     role: newAdmin.role,
                //     school: newAdmin.school,
                //   };
                // }
                throw new AppError_1.AppError("Role inválido.", 400);
            }
            catch (error) {
                console.error("Erro ao criar usuário:", error);
                throw new AppError_1.AppError(error.message || "Erro ao criar usuário.", 500);
            }
        });
    }
}
exports.CreateUserService = CreateUserService;
