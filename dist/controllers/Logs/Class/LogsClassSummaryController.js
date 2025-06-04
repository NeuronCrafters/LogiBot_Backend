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
exports.LogsClassSummaryController = LogsClassSummaryController;
const LogsClassSummaryService_1 = require("../../../services/Logs/Class/LogsClassSummaryService");
const Professor_1 = require("../../../models/Professor");
const UserAnalysis_1 = require("../../../models/UserAnalysis");
const mongoose_1 = require("mongoose");
function LogsClassSummaryController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { classId } = req.params;
            const userId = req.user.id;
            const userRole = req.user.role;
            console.log("Requisição para resumo de turma:", classId);
            if (!classId) {
                return res.status(400).json({ message: "O ID da turma é obrigatório." });
            }
            // Admin pode tudo
            if (userRole.includes("admin")) {
                console.log("Usuário admin acessando dados");
                const summary = yield (0, LogsClassSummaryService_1.LogsClassSummaryService)(classId);
                return res.status(200).json(summary);
            }
            const professor = yield Professor_1.Professor.findOne({ userId });
            if (!professor) {
                console.log("Professor não encontrado para userId:", userId);
                return res.status(403).json({ message: "Professor não encontrado." });
            }
            const isCoordinator = professor.role.includes("course-coordinator");
            const classObjectId = new mongoose_1.Types.ObjectId(classId);
            console.log("Perfil do professor:", {
                isCoordinator,
                courses: professor.courses.map(c => c.toString())
            });
            // Coordenador pode ver dados se a turma for de um curso que ele coordena
            if (isCoordinator) {
                console.log("Verificando se coordenador coordena o curso da turma");
                // Busca a turma e pega seu courseId
                const alunoDaTurma = yield UserAnalysis_1.UserAnalysis.findOne({ classId: classObjectId });
                if (alunoDaTurma) {
                    const courseIdFromClass = alunoDaTurma.courseId;
                    console.log("Curso da turma:", courseIdFromClass);
                    const coordenaCurso = professor.courses.some((c) => c.equals(courseIdFromClass));
                    console.log("Professor coordena o curso?", coordenaCurso);
                    if (coordenaCurso) {
                        console.log("Coordenador com acesso ao curso da turma");
                        const summary = yield (0, LogsClassSummaryService_1.LogsClassSummaryService)(classId);
                        return res.status(200).json(summary);
                    }
                }
                else {
                    console.log("Nenhum aluno encontrado para a turma");
                }
            }
            console.log("Acesso negado - perfil não tem permissão");
            return res.status(403).json({ message: "Acesso negado. Apenas coordenadores do curso da turma têm permissão." });
        }
        catch (error) {
            console.error("[LogsClassSummaryController] Erro:", error);
            return res.status(500).json({ message: "Erro ao obter dados da turma." });
        }
    });
}
