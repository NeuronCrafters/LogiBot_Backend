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
exports.categoryClicksController = categoryClicksController;
const CategoryClicksService_1 = require("../../services/userAnalysis/CategoryClicksService");
const normalizeSubject_1 = require("../../utils/normalizeSubject");
function categoryClicksController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { userId, clicks } = req.body;
            if (!userId || typeof clicks !== "object") {
                return res.status(400).json({ message: "Payload inválido." });
            }
            const normalized = {
                variaveis: 0,
                tipos: 0,
                funcoes: 0,
                loops: 0,
                verificacoes: 0,
            };
            for (const [raw, count] of Object.entries(clicks)) {
                let cat = (0, normalizeSubject_1.normalizeSubjectFromMessage)(raw)
                    || "tipos";
                normalized[cat] = (normalized[cat] || 0) + count;
            }
            yield (0, CategoryClicksService_1.updateCategoryClicksService)(userId, normalized);
            return res
                .status(200)
                .json({ message: "Cliques de categoria contabilizados com sucesso." });
        }
        catch (err) {
            console.error("[CategoryClicksController] Erro:", err);
            return res
                .status(500)
                .json({
                message: "Erro ao processar cliques de categoria.",
                detail: err.message,
            });
        }
    });
}
