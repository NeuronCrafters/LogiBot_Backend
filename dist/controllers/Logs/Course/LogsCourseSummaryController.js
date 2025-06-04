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
exports.LogsCourseSummaryController = LogsCourseSummaryController;
const LogsCourseSummaryService_1 = require("../../../services/Logs/Course/LogsCourseSummaryService");
const Professor_1 = require("../../../models/Professor");
const mongoose_1 = require("mongoose");
function LogsCourseSummaryController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { courseId } = req.params;
            const userRole = req.user.role;
            const userId = req.user.id;
            console.log("Requisição para resumo de curso:", courseId);
            if (!courseId) {
                return res.status(400).json({ message: "O ID do curso é obrigatório." });
            }
            if (userRole.includes("admin")) {
                console.log("Usuário admin acessando dados");
                const summary = yield (0, LogsCourseSummaryService_1.LogsCourseSummaryService)(courseId);
                return res.status(200).json(summary);
            }
            const professor = yield Professor_1.Professor.findOne({ userId });
            if (!professor) {
                console.log("Professor não encontrado para userId:", userId);
                return res.status(403).json({ message: "Professor não encontrado." });
            }
            const isCoordinator = professor.role.includes("course-coordinator");
            const courseObjectId = new mongoose_1.Types.ObjectId(courseId);
            console.log("Perfil do professor:", {
                isCoordinator,
                courses: professor.courses.map(c => c.toString())
            });
            if (isCoordinator && professor.courses.some((c) => c.equals(courseObjectId))) {
                console.log("Coordenador com acesso ao curso solicitado");
                const summary = yield (0, LogsCourseSummaryService_1.LogsCourseSummaryService)(courseId);
                return res.status(200).json(summary);
            }
            console.log("Acesso negado - perfil não tem permissão");
            return res.status(403).json({ message: "Acesso negado. Apenas coordenadores do curso têm permissão." });
        }
        catch (error) {
            console.error("[LogsCourseSummaryController] Erro:", error);
            return res.status(500).json({ message: "Erro ao obter dados do curso." });
        }
    });
}
