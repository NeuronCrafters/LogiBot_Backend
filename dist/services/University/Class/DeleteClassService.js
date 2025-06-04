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
exports.DeleteClassService = void 0;
const Class_1 = require("../../../models/Class");
const AppError_1 = require("../../../exceptions/AppError");
const mongoose_1 = require("mongoose");
class DeleteClassService {
    deleteClass(classId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(classId)) {
                throw new AppError_1.AppError("ID da turma inválido!", 400);
            }
            const classDoc = yield Class_1.Class.findById(classId);
            if (!classDoc) {
                throw new AppError_1.AppError("Turma não encontrada!", 404);
            }
            yield Class_1.Class.findOneAndDelete({ _id: classId });
            return { message: "Turma removida com sucesso!" };
        });
    }
}
exports.DeleteClassService = DeleteClassService;
