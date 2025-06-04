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
exports.ListProfessorsByCourseService = void 0;
const Course_1 = require("../../../models/Course");
const AppError_1 = require("../../../exceptions/AppError");
class ListProfessorsByCourseService {
    execute(courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            const course = yield Course_1.Course.findById(courseId).populate("professors", "name email");
            if (!course) {
                throw new AppError_1.AppError("Curso não encontrado.", 404);
            }
            return course.professors;
        });
    }
}
exports.ListProfessorsByCourseService = ListProfessorsByCourseService;
