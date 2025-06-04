"use strict";
// controllers/Logs/Comparison/LogsCoursesComparisonController.ts
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
exports.LogsCoursesComparisonController = LogsCoursesComparisonController;
const LogsCoursesComparisonService_1 = require("../../../services/Logs/Course/LogsCoursesComparisonService");
const Professor_1 = require("../../../models/Professor");
const mongoose_1 = require("mongoose");
function LogsCoursesComparisonController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { courseId1, courseId2 } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;
            if (!courseId1 || !courseId2) {
                return res.status(400).json({
                    message: "Os IDs dos dois cursos são obrigatórios."
                });
            }
            // Se o usuário é admin, tem acesso direto
            if (userRole.includes("admin")) {
                const comparison = yield (0, LogsCoursesComparisonService_1.LogsCoursesComparisonService)(courseId1, courseId2);
                return res.status(200).json(comparison);
            }
            // Se não for admin, verifica se é coordenador com acesso aos cursos
            const professor = yield Professor_1.Professor.findOne({ userId });
            if (!professor) {
                return res.status(403).json({ message: "Professor não encontrado." });
            }
            const isCoordinator = professor.role.includes("course-coordinator");
            if (!isCoordinator) {
                return res.status(403).json({
                    message: "Apenas coordenadores podem comparar cursos."
                });
            }
            // Verifica se tem acesso aos dois cursos
            const courseObjectId1 = new mongoose_1.Types.ObjectId(courseId1);
            const courseObjectId2 = new mongoose_1.Types.ObjectId(courseId2);
            const hasAccessToCourse1 = professor.courses.some(c => c.equals(courseObjectId1));
            const hasAccessToCourse2 = professor.courses.some(c => c.equals(courseObjectId2));
            if (!hasAccessToCourse1 || !hasAccessToCourse2) {
                return res.status(403).json({
                    message: "Acesso negado. Coordenador não tem acesso a um ou ambos os cursos."
                });
            }
            const comparison = yield (0, LogsCoursesComparisonService_1.LogsCoursesComparisonService)(courseId1, courseId2);
            return res.status(200).json(comparison);
        }
        catch (error) {
            console.error("[LogsCoursesComparisonController] Erro:", error);
            return res.status(500).json({
                message: "Erro ao comparar cursos."
            });
        }
    });
}
