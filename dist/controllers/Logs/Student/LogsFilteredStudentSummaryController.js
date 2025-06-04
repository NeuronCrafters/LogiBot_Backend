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
exports.LogsFilteredStudentSummaryController = LogsFilteredStudentSummaryController;
const LogsFilteredStudentSummaryService_1 = require("../../../services/Logs/Student/LogsFilteredStudentSummaryService");
const UserAnalysis_1 = require("../../../models/UserAnalysis");
const Professor_1 = require("../../../models/Professor");
const Discipline_1 = require("../../../models/Discipline");
const mongoose_1 = require("mongoose");
function LogsFilteredStudentSummaryController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { universityId, courseId, classId, studentId } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;
            console.log("Requisição para filtrar dados de estudante:", {
                universityId, courseId, classId, studentId
            });
            if (!universityId) {
                return res.status(400).json({ message: "O ID da universidade é obrigatório." });
            }
            if (userRole.includes("admin")) {
                console.log("Usuário admin acessando dados");
                const summary = yield (0, LogsFilteredStudentSummaryService_1.LogsFilteredStudentSummaryService)(universityId, courseId, classId, studentId);
                return res.status(200).json(summary);
            }
            const professor = yield Professor_1.Professor.findOne({ userId });
            if (!professor) {
                console.log("Professor não encontrado para userId:", userId);
                return res.status(403).json({ message: "Professor não encontrado." });
            }
            const isCoordinator = professor.role.includes("course-coordinator");
            const isProfessor = professor.role.includes("professor");
            console.log("Perfil do professor:", {
                isCoordinator, isProfessor, courses: professor.courses
            });
            const courseObjectId = courseId ? new mongoose_1.Types.ObjectId(courseId) : null;
            const classObjectId = classId ? new mongoose_1.Types.ObjectId(classId) : null;
            if (isCoordinator && courseObjectId && professor.courses.some((c) => c.equals(courseObjectId))) {
                console.log("Coordenador com acesso ao curso solicitado");
                const summary = yield (0, LogsFilteredStudentSummaryService_1.LogsFilteredStudentSummaryService)(universityId, courseId, classId, studentId);
                return res.status(200).json(summary);
            }
            if (isProfessor && courseId && classId) {
                console.log("Professor verificando acesso às disciplinas da turma");
                const disciplinas = yield Discipline_1.Discipline.find({
                    _id: { $in: professor.disciplines },
                    classes: classId,
                });
                console.log(`Encontradas ${disciplinas.length} disciplinas para o professor na turma`);
                if (disciplinas.length === 0) {
                    return res.status(403).json({ message: "Acesso negado. Nenhuma disciplina encontrada." });
                }
                if (studentId) {
                    console.log("Verificando acesso ao aluno específico:", studentId);
                    // Verificar se o aluno está matriculado em alguma disciplina do professor
                    const alunosNasDisciplinas = yield UserAnalysis_1.UserAnalysis.find({
                        userId: studentId,
                        schoolId: universityId,
                        courseId,
                        classId
                    });
                    console.log(`Encontrados ${alunosNasDisciplinas.length} registros do aluno`);
                    if (alunosNasDisciplinas.length === 0) {
                        return res.status(403).json({ message: "Acesso negado ao aluno específico." });
                    }
                }
                console.log("Professor tem acesso, buscando summary");
                const summary = yield (0, LogsFilteredStudentSummaryService_1.LogsFilteredStudentSummaryService)(universityId, courseId, classId, studentId);
                return res.status(200).json(summary);
            }
            console.log("Acesso negado - perfil não tem permissão");
            return res.status(403).json({ message: "Acesso negado." });
        }
        catch (error) {
            console.error("[LogsFilteredStudentSummaryController] Erro:", error);
            return res.status(500).json({ message: "Erro ao obter dados filtrados do aluno." });
        }
    });
}
