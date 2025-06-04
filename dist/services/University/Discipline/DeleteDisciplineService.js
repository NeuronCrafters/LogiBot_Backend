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
exports.DeleteDisciplineService = void 0;
const Discipline_1 = require("../../../models/Discipline");
const AppError_1 = require("../../../exceptions/AppError");
const mongoose_1 = require("mongoose");
class DeleteDisciplineService {
    execute(disciplineId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(disciplineId)) {
                throw new AppError_1.AppError("ID da disciplina inválido!", 400);
            }
            const discipline = yield Discipline_1.Discipline.findById(disciplineId);
            if (!discipline) {
                throw new AppError_1.AppError("Disciplina não encontrada!", 404);
            }
            yield Discipline_1.Discipline.findOneAndDelete({ _id: disciplineId });
            return { message: "Disciplina excluída com sucesso!" };
        });
    }
}
exports.DeleteDisciplineService = DeleteDisciplineService;
