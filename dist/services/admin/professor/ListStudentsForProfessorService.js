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
exports.ListStudentsForProfessorService = ListStudentsForProfessorService;
const Professor_1 = require("../../../models/Professor");
const User_1 = require("../../../models/User");
/**
 * Retorna todos os alunos que estão matriculados em
 * quaisquer disciplinas que o próprio professor ministra.
 *
 * @param professorId  ID do professor (obtido do token)
 * @returns lista de IUser (role inclui "student")
 */
function ListStudentsForProfessorService(professorId) {
    return __awaiter(this, void 0, void 0, function* () {
        const prof = yield Professor_1.Professor.findById(professorId).select("disciplines school course");
        if (!prof) {
            throw new Error("Professor não encontrado.");
        }
        return User_1.User.find({
            role: "student",
            school: prof.school,
            course: { $in: prof.courses },
            disciplines: { $in: prof.disciplines },
        }).exec();
    });
}
