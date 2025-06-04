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
exports.LogsStudentsComparisonController = LogsStudentsComparisonController;
const LogsStudentsComparisonService_1 = require("../../../services/Logs/Student/LogsStudentsComparisonService");
const Professor_1 = require("../../../models/Professor");
const Discipline_1 = require("../../../models/Discipline");
const UserAnalysis_1 = require("../../../models/UserAnalysis");
const mongoose_1 = require("mongoose");
function LogsStudentsComparisonController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { studentId1, studentId2, classId } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;
            if (!studentId1 || !studentId2 || !classId) {
                return res.status(400).json({
                    message: "Os IDs dos dois alunos e da turma são obrigatórios."
                });
            }
            // Verificar se os alunos existem e estão na mesma turma
            const student1Analysis = yield UserAnalysis_1.UserAnalysis.findOne({ userId: studentId1, classId });
            const student2Analysis = yield UserAnalysis_1.UserAnalysis.findOne({ userId: studentId2, classId });
            if (!student1Analysis || !student2Analysis) {
                return res.status(404).json({
                    message: "Um ou ambos os alunos não foram encontrados na turma especificada."
                });
            }
            // Permissões
            if (userRole.includes("admin")) {
                const comparison = yield (0, LogsStudentsComparisonService_1.LogsStudentsComparisonService)(studentId1, studentId2, classId);
                return res.status(200).json(comparison);
            }
            const professor = yield Professor_1.Professor.findOne({ userId });
            if (!professor) {
                return res.status(403).json({ message: "Professor não encontrado." });
            }
            const isCoordinator = professor.role.includes("course-coordinator");
            // Se é coordenador, verifica se tem acesso ao curso da turma
            if (isCoordinator) {
                const courseId = student1Analysis.courseId;
                const courseObjectId = new mongoose_1.Types.ObjectId(courseId);
                const hasCourseAccess = professor.courses.some(c => c.equals(courseObjectId));
                if (hasCourseAccess) {
                    const comparison = yield (0, LogsStudentsComparisonService_1.LogsStudentsComparisonService)(studentId1, studentId2, classId);
                    return res.status(200).json(comparison);
                }
            }
            // Se é professor regular, verifica se leciona na turma
            const isProfessor = professor.role.includes("professor");
            if (isProfessor) {
                const disciplinesInClass = yield Discipline_1.Discipline.find({
                    _id: { $in: professor.disciplines },
                    classes: classId
                });
                if (disciplinesInClass.length > 0) {
                    const comparison = yield (0, LogsStudentsComparisonService_1.LogsStudentsComparisonService)(studentId1, studentId2, classId);
                    return res.status(200).json(comparison);
                }
            }
            return res.status(403).json({
                message: "Acesso negado. Você não tem permissão para comparar estes alunos."
            });
        }
        catch (error) {
            console.error("[LogsStudentsComparisonController] Erro:", error);
            return res.status(500).json({
                message: "Erro ao comparar alunos."
            });
        }
    });
}
