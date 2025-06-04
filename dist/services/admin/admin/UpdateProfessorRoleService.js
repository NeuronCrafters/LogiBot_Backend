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
exports.UpdateProfessorRoleService = void 0;
const Professor_1 = require("../../../models/Professor");
const AppError_1 = require("../../../exceptions/AppError");
class UpdateProfessorRoleService {
    execute(professorId, action) {
        return __awaiter(this, void 0, void 0, function* () {
            const professor = yield Professor_1.Professor.findById(professorId);
            if (!professor) {
                throw new AppError_1.AppError("Professor não encontrado", 404);
            }
            const currentRoles = professor.role;
            if (action === "add") {
                if (currentRoles.includes("course-coordinator")) {
                    throw new AppError_1.AppError("Este professor já é coordenador de curso.", 400);
                }
                const existingCoordinator = yield Professor_1.Professor.findOne({
                    role: { $in: ["course-coordinator"] },
                    courses: { $in: professor.courses },
                    school: professor.school,
                    _id: { $ne: professorId }
                });
                if (existingCoordinator) {
                    throw new AppError_1.AppError("Já existe um coordenador para este curso nesta universidade.", 409);
                }
                professor.role.push("course-coordinator");
            }
            if (action === "remove") {
                professor.role = currentRoles.filter(role => role !== "course-coordinator");
                if (!professor.role.includes("professor")) {
                    professor.role.push("professor");
                }
            }
            yield professor.save();
            return professor;
        });
    }
}
exports.UpdateProfessorRoleService = UpdateProfessorRoleService;
