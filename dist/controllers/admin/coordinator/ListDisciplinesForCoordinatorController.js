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
exports.ListDisciplinesForCoordinatorController = ListDisciplinesForCoordinatorController;
const ListDisciplinesForCoordinatorService_1 = require("../../../services/admin/coordinator/ListDisciplinesForCoordinatorService");
const Professor_1 = require("../../../models/Professor");
function ListDisciplinesForCoordinatorController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const authUser = req.user;
        if (!authUser.role.includes("course-coordinator")) {
            return res.status(403).json({ message: "Acesso negado." });
        }
        const prof = yield Professor_1.Professor.findById(authUser.id).select("courses").lean();
        if (!prof) {
            return res.status(404).json({ message: "Coordenador não encontrado." });
        }
        const courseId = (prof.courses || []).map(String)[0];
        if (!courseId) {
            return res
                .status(400)
                .json({ message: "Você não está associado a nenhum curso." });
        }
        try {
            const disciplines = yield (0, ListDisciplinesForCoordinatorService_1.ListDisciplinesForCoordinatorService)(authUser.school, courseId);
            return res.json(disciplines);
        }
        catch (err) {
            if (err.message.includes("não pertence")) {
                return res.status(403).json({ message: err.message });
            }
            return res.status(500).json({ message: "Erro interno." });
        }
    });
}
