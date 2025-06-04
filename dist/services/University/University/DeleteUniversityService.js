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
exports.DeleteUniversityService = void 0;
const University_1 = require("../../../models/University");
const Course_1 = require("../../../models/Course");
const Class_1 = require("../../../models/Class");
const Discipline_1 = require("../../../models/Discipline");
const User_1 = require("../../../models/User");
const AppError_1 = require("../../../exceptions/AppError");
const mongoose_1 = require("mongoose");
class DeleteUniversityService {
    execute(universityId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(universityId)) {
                throw new AppError_1.AppError("ID da universidade inválido!", 400);
            }
            const university = yield University_1.University.findById(universityId);
            if (!university) {
                throw new AppError_1.AppError("Universidade não encontrada!", 404);
            }
            const courses = yield Course_1.Course.find({ university: universityId }).select('_id');
            const courseIds = courses.map((course) => course._id);
            yield Promise.all([
                Course_1.Course.deleteMany({ university: universityId }),
                Class_1.Class.deleteMany({ course: { $in: courseIds } }),
                Discipline_1.Discipline.deleteMany({ course: { $in: courseIds } }),
                User_1.User.deleteMany({ role: "student", course: { $in: courseIds } }),
                User_1.User.deleteMany({ role: "professor", university: university._id })
            ]);
            yield University_1.University.findByIdAndDelete(universityId);
            return { message: "Universidade e todos os dados relacionados foram removidos com sucesso!" };
        });
    }
}
exports.DeleteUniversityService = DeleteUniversityService;
