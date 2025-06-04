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
exports.ListStudentsByClassForCoordinatorController = ListStudentsByClassForCoordinatorController;
const mongoose_1 = require("mongoose");
const ListStudentsByClassForCoordinatorService_1 = require("../../../services/admin/coordinator/ListStudentsByClassForCoordinatorService");
const Professor_1 = require("../../../models/Professor");
function ListStudentsByClassForCoordinatorController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const authUser = req.user;
        const isAdmin = authUser.role.includes("admin");
        const isCoordinator = authUser.role.includes("course-coordinator");
        if (!isAdmin && !isCoordinator) {
            return res.status(403).json({ message: "Acesso negado." });
        }
        // valida classId
        const classId = String(req.params.classId || "");
        if (!(0, mongoose_1.isValidObjectId)(classId)) {
            return res.status(400).json({ message: "classId inválido ou ausente." });
        }
        // resolve courseId
        let courseId;
        if (isCoordinator) {
            const prof = yield Professor_1.Professor.findById(authUser.id).select("courses").lean();
            if (!((_a = prof === null || prof === void 0 ? void 0 : prof.courses) === null || _a === void 0 ? void 0 : _a.length)) {
                return res
                    .status(400)
                    .json({ message: "Coordenador sem curso associado." });
            }
            courseId = String(prof.courses[0]);
        }
        else {
            const raw = req.query.courseId;
            if (!raw) {
                return res
                    .status(400)
                    .json({ message: "Parâmetro courseId é obrigatório para admin." });
            }
            courseId = Array.isArray(raw) ? String(raw[0]) : String(raw);
            if (!(0, mongoose_1.isValidObjectId)(courseId)) {
                return res.status(400).json({ message: "courseId inválido." });
            }
        }
        try {
            const students = yield (0, ListStudentsByClassForCoordinatorService_1.ListStudentsByClassForCoordinatorService)(
            // para admin passa undefined, para coord passa authUser.school
            isCoordinator ? authUser.school : undefined, courseId, classId);
            return res.status(200).json(students);
        }
        catch (err) {
            console.error("Erro ao listar alunos por turma:", err);
            return res
                .status(500)
                .json({ message: "Erro interno ao listar alunos por turma." });
        }
    });
}
