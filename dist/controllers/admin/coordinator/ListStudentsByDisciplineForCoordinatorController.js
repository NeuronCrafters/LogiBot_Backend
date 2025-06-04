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
exports.ListStudentsByDisciplineForCoordinatorController = ListStudentsByDisciplineForCoordinatorController;
const ListStudentsByDisciplineForCoordinatorService_1 = require("../../../services/admin/coordinator/ListStudentsByDisciplineForCoordinatorService");
const Professor_1 = require("../../../models/Professor");
function ListStudentsByDisciplineForCoordinatorController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const authUser = req.user;
        const { disciplineId } = req.params;
        if (!authUser.role.includes("course-coordinator")) {
            return res.status(403).json({ message: "Acesso negado." });
        }
        const prof = yield Professor_1.Professor.findById(authUser.id).select("courses").lean();
        if (!prof) {
            return res.status(404).json({ message: "Professor não encontrado." });
        }
        const courses = (prof.courses || []).map((c) => c.toString());
        if (courses.length === 0) {
            return res
                .status(400)
                .json({ message: "Coordenador não está associado a nenhum curso." });
        }
        const courseId = courses[0];
        const students = yield (0, ListStudentsByDisciplineForCoordinatorService_1.ListStudentsByDisciplineForCoordinatorService)(authUser.school, courseId, disciplineId);
        return res.json(students);
    });
}
