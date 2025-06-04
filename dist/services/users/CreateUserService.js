"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const User_1 = require("../../models/User");
const Discipline_1 = require("../../models/Discipline");
const Class_1 = require("../../models/Class");
const AppError_1 = require("../../exceptions/AppError");
const bcryptjs_1 = require("bcryptjs");
const generateCode_1 = require("../../config/generateCode");
class CreateUserService {
    createUser(_a) {
        return __awaiter(this, arguments, void 0, function* ({ name, email, password, code }) {
            // Verificar se já existe usuário com este email
            const existingUser = yield User_1.User.findOne({ email });
            if (existingUser) {
                throw new AppError_1.AppError("Usuário já existe com este email!", 409);
            }
            // Buscar entidades pelo código da disciplina
            const entities = yield (0, generateCode_1.findEntitiesByCode)(code);
            if (!entities) {
                throw new AppError_1.AppError("Código de disciplina inválido!", 404);
            }
            const { university, course, discipline, classes } = entities;
            // Verificar se a disciplina tem turmas
            if (!classes || classes.length === 0) {
                throw new AppError_1.AppError("A disciplina não possui turmas cadastradas!", 400);
            }
            // Para códigos específicos de turma, precisamos identificar qual turma
            // Vamos buscar qual das turmas da disciplina corresponde ao código
            let selectedClass = null;
            // Se há múltiplas turmas, vamos procurar qual turma específica o código representa
            for (const classItem of classes) {
                // Tentar gerar o mesmo código para verificar se corresponde
                const { generateDisciplineCode } = yield Promise.resolve().then(() => __importStar(require("../../config/generateCode")));
                const testCode = generateDisciplineCode(university._id.toString(), course._id.toString(), classItem._id.toString(), discipline._id.toString());
                if (testCode === code) {
                    selectedClass = classItem;
                    break;
                }
            }
            // Se não encontrou turma específica, usar a primeira
            if (!selectedClass) {
                selectedClass = classes[0];
            }
            // Criptografar a senha
            const hashedPassword = yield (0, bcryptjs_1.hash)(password, 10);
            // Criar o usuário
            const user = yield User_1.User.create({
                name,
                email,
                password: hashedPassword,
                school: university._id,
                course: course._id,
                class: selectedClass._id,
                disciplines: [discipline._id],
                role: ["student"],
                status: "active"
            });
            // Adicionar o usuário à disciplina
            yield Discipline_1.Discipline.findByIdAndUpdate(discipline._id, {
                $addToSet: { students: user._id }
            });
            // Adicionar o usuário à turma específica
            yield Class_1.Class.findByIdAndUpdate(selectedClass._id, {
                $addToSet: { students: user._id }
            });
            // Retornar dados do usuário (sem a senha) com informações completas
            const userResponse = yield User_1.User.findById(user._id)
                .populate('school', 'name')
                .populate('course', 'name')
                .populate('class', 'name')
                .populate('disciplines', 'name code')
                .select('-password');
            return {
                user: userResponse,
                assignedClass: {
                    id: selectedClass._id,
                    name: selectedClass.name
                },
                discipline: {
                    id: discipline._id,
                    name: discipline.name
                },
                course: {
                    id: course._id,
                    name: course.name
                },
                university: {
                    id: university._id,
                    name: university.name
                }
            };
        });
    }
}
exports.CreateUserService = CreateUserService;
