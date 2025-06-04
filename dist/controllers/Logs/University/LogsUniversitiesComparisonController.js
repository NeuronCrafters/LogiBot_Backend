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
exports.LogsUniversitiesComparisonController = LogsUniversitiesComparisonController;
const LogsUniversitiesComparisonService_1 = require("../../../services/Logs/University/LogsUniversitiesComparisonService");
function LogsUniversitiesComparisonController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { universityId1, universityId2 } = req.body;
            if (!universityId1 || !universityId2) {
                return res.status(400).json({
                    message: "Os IDs das duas universidades são obrigatórios."
                });
            }
            const userRole = req.user.role;
            // Verificar se o usuário tem permissão de admin
            if (!userRole.includes("admin")) {
                return res.status(403).json({
                    message: "Apenas administradores podem comparar universidades."
                });
            }
            const comparison = yield (0, LogsUniversitiesComparisonService_1.LogsUniversitiesComparisonService)(universityId1, universityId2);
            return res.status(200).json(comparison);
        }
        catch (error) {
            console.error("[LogsUniversitiesComparisonController] Erro:", error);
            return res.status(500).json({
                message: "Erro ao comparar universidades."
            });
        }
    });
}
