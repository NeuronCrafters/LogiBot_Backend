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
exports.LogsUniversitySummaryController = LogsUniversitySummaryController;
const LogsUniversitySummaryService_1 = require("../../../services/Logs/University/LogsUniversitySummaryService");
const Professor_1 = require("../../../models/Professor");
const University_1 = require("../../../models/University");
function LogsUniversitySummaryController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { universityId } = req.params;
            const userRole = req.user.role;
            const userId = req.user.id;
            console.log("Requisição para resumo de universidade:", universityId);
            if (!universityId) {
                return res.status(400).json({ message: "O ID da universidade é obrigatório." });
            }
            // Admin pode tudo
            if (userRole.includes("admin")) {
                console.log("Usuário admin acessando dados");
                const summary = yield (0, LogsUniversitySummaryService_1.LogsUniversitySummaryService)(universityId);
                return res.status(200).json(summary);
            }
            // Verificar se usuário é coordenador da universidade
            const professor = yield Professor_1.Professor.findOne({ userId });
            if (!professor) {
                console.log("Professor não encontrado para userId:", userId);
                return res.status(403).json({ message: "Professor não encontrado." });
            }
            const university = yield University_1.University.findById(universityId);
            if (!university) {
                return res.status(404).json({ message: "Universidade não encontrada." });
            }
            // Verifica se professor é coordenador institucional da universidade
            const isInstitutionalCoordinator = professor.role.includes("institutional-coordinator");
            const professorsUniversityId = (_a = professor.school) === null || _a === void 0 ? void 0 : _a.toString();
            const requestedUniversityId = university._id.toString();
            console.log("Verificação de permissão:", {
                isInstitutionalCoordinator,
                professorsUniversityId,
                requestedUniversityId
            });
            if (isInstitutionalCoordinator && professorsUniversityId === requestedUniversityId) {
                console.log("Coordenador institucional acessando dados da sua universidade");
                const summary = yield (0, LogsUniversitySummaryService_1.LogsUniversitySummaryService)(universityId);
                return res.status(200).json(summary);
            }
            console.log("Acesso negado - perfil não tem permissão");
            return res.status(403).json({ message: "Acesso negado. Apenas coordenadores institucionais da universidade têm permissão." });
        }
        catch (error) {
            console.error("[LogsUniversitySummaryController] Erro:", error);
            return res.status(500).json({ message: "Erro ao obter dados da universidade." });
        }
    });
}
