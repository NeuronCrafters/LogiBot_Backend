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
exports.ListProfessorsByUniversityService = void 0;
const Professor_1 = require("../../../models/Professor");
const AppError_1 = require("../../../exceptions/AppError");
class ListProfessorsByUniversityService {
    execute(schoolId) {
        return __awaiter(this, void 0, void 0, function* () {
            const professors = yield Professor_1.Professor.find({ school: schoolId }).select("name email role school courses");
            if (!professors || professors.length === 0) {
                throw new AppError_1.AppError("Nenhum professor encontrado para essa universidade.", 404);
            }
            return professors;
        });
    }
}
exports.ListProfessorsByUniversityService = ListProfessorsByUniversityService;
