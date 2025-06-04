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
exports.DeleteDisciplineController = void 0;
const DeleteDisciplineService_1 = require("../../../services/University/Discipline/DeleteDisciplineService");
class DeleteDisciplineController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { disciplineId } = req.params;
                if (!disciplineId) {
                    return res.status(400).json({ message: "ID da disciplina é obrigatório!" });
                }
                const deleteDisciplineService = new DeleteDisciplineService_1.DeleteDisciplineService();
                const result = yield deleteDisciplineService.execute(disciplineId);
                return res.status(200).json(result);
            }
            catch (error) {
                return res.status(error.statusCode || 500).json({ message: error.message });
            }
        });
    }
}
exports.DeleteDisciplineController = DeleteDisciplineController;
