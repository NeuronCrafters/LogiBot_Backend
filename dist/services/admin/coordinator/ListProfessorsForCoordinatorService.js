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
exports.ListProfessorsForCoordinatorService = ListProfessorsForCoordinatorService;
const Professor_1 = require("../../../models/Professor");
/**
 * Retorna todos os professores que pertencem à mesma escola e
 * ao mesmo curso do coordenador.
 *
 * @param schoolId  ID da universidade do coordenador
 * @param courseId  ID do curso do coordenador
 * @returns lista de IProfessor
 */
function ListProfessorsForCoordinatorService(schoolId, courseId) {
    return __awaiter(this, void 0, void 0, function* () {
        return Professor_1.Professor.find({
            school: schoolId,
            courses: courseId,
        }).exec();
    });
}
