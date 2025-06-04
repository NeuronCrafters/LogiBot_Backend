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
exports.LogsClassesComparisonController = LogsClassesComparisonController;
const LogsClassComparisonService_1 = require("../../../services/Logs/Class/LogsClassComparisonService");
const Professor_1 = require("../../../models/Professor");
const Discipline_1 = require("../../../models/Discipline");
const Class_1 = require("../../../models/Class");
function LogsClassesComparisonController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { classId1, classId2 } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;
            if (!classId1 || !classId2) {
                return res.status(400).json({
                    message: "Os IDs das duas turmas são obrigatórios."
                });
            }
            // Verificar se as turmas existem e são do mesmo curso
            const class1 = yield Class_1.Class.findById(classId1);
            const class2 = yield Class_1.Class.findById(classId2);
            if (!class1 || !class2) {
                return res.status(404).json({
                    message: "Uma ou ambas as turmas não foram encontradas."
                });
            }
            // Corrigido: usando course em vez de courseId
            if (!class1.course.equals(class2.course)) {
                return res.status(400).json({
                    message: "As turmas devem pertencer ao mesmo curso para comparação."
                });
            }
            // Permissões
            if (userRole.includes("admin")) {
                const comparison = yield (0, LogsClassComparisonService_1.LogsClassComparisonService)(classId1, classId2);
                return res.status(200).json(comparison);
            }
            const professor = yield Professor_1.Professor.findOne({ userId });
            if (!professor) {
                return res.status(403).json({ message: "Professor não encontrado." });
            }
            const isCoordinator = professor.role.includes("course-coordinator");
            // Se é coordenador, verifica se tem acesso ao curso das turmas
            if (isCoordinator) {
                // Corrigido: usando course em vez de courseId
                const hasCourseAccess = professor.courses.some(c => c.equals(class1.course));
                if (hasCourseAccess) {
                    const comparison = yield (0, LogsClassComparisonService_1.LogsClassComparisonService)(classId1, classId2);
                    return res.status(200).json(comparison);
                }
            }
            // Se é professor regular, verifica se leciona em ambas as turmas
            const isProfessor = professor.role.includes("professor");
            if (isProfessor) {
                const disciplinesClass1 = yield Discipline_1.Discipline.find({
                    _id: { $in: professor.disciplines },
                    classes: classId1
                });
                const disciplinesClass2 = yield Discipline_1.Discipline.find({
                    _id: { $in: professor.disciplines },
                    classes: classId2
                });
                if (disciplinesClass1.length > 0 && disciplinesClass2.length > 0) {
                    const comparison = yield (0, LogsClassComparisonService_1.LogsClassComparisonService)(classId1, classId2);
                    return res.status(200).json(comparison);
                }
            }
            return res.status(403).json({
                message: "Acesso negado. Você não tem permissão para comparar estas turmas."
            });
        }
        catch (error) {
            console.error("[LogsClassesComparisonController] Erro:", error);
            return res.status(500).json({
                message: "Erro ao comparar turmas."
            });
        }
    });
}
