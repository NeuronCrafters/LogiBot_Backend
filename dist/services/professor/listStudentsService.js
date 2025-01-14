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
exports.ListStudentsService = void 0;
const Professor_1 = require("../../models/Professor");
class ListStudentsService {
    execute(professorId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const professor = yield Professor_1.Professor.findById(professorId).populate("students");
                if (!professor) {
                    throw new Error("Professor não encontrado.");
                }
                const students = professor.students;
                return students.map((student) => ({
                    id: student._id.toString(),
                    name: student.name,
                    email: student.email,
                    role: student.role,
                    school: student.school,
                }));
            }
            catch (error) {
                console.error("Erro ao listar alunos:", error);
                throw new Error("Erro ao listar alunos.");
            }
        });
    }
}
exports.ListStudentsService = ListStudentsService;
