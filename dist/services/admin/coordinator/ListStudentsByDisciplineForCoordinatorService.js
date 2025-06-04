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
exports.ListStudentsByDisciplineForCoordinatorService = ListStudentsByDisciplineForCoordinatorService;
const User_1 = require("../../../models/User");
/**
 * Retorna todos os alunos da disciplina especificada,
 * desde que pertençam ao mesmo curso e escola do coordenador.
 *
 * @param schoolId      ID da universidade do coordenador
 * @param courseId      ID do curso do coordenador
 * @param disciplineId  ID da disciplina
 * @returns lista de IUser (role inclui "student")
 */
function ListStudentsByDisciplineForCoordinatorService(schoolId, courseId, disciplineId) {
    return __awaiter(this, void 0, void 0, function* () {
        return User_1.User.find({
            role: "student",
            school: schoolId,
            course: courseId,
            disciplines: disciplineId,
        }).exec();
    });
}
