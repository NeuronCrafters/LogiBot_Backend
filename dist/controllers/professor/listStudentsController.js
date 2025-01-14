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
exports.ListStudentsController = void 0;
const listStudentsService_1 = require("../../services/professor/listStudentsService");
class ListStudentsController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { professorId } = req.params;
            try {
                const listStudentsService = new listStudentsService_1.ListStudentsService();
                const students = yield listStudentsService.execute(professorId);
                return res.json(students);
            }
            catch (error) {
                console.error("Erro ao listar alunos:", error);
                return res.status(500).json({ error: error.message });
            }
        });
    }
}
exports.ListStudentsController = ListStudentsController;
