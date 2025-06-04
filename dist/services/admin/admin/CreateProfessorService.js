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
exports.CreateProfessorService = void 0;
const Professor_1 = require("../../../models/Professor");
const Course_1 = require("../../../models/Course");
const AppError_1 = require("../../../exceptions/AppError");
const mongoose_1 = require("mongoose");
const bcryptjs_1 = require("bcryptjs");
class CreateProfessorService {
    execute(_a) {
        return __awaiter(this, arguments, void 0, function* ({ name, email, password, courses, school }) {
            if (!name || !email || !password || !school || !courses || !Array.isArray(courses)) {
                throw new AppError_1.AppError("Dados obrigatórios ausentes ou inválidos.", 400);
            }
            if (courses.length === 0) {
                throw new AppError_1.AppError("Pelo menos um curso deve ser selecionado.", 400);
            }
            const existingProfessor = yield Professor_1.Professor.findOne({ email });
            if (existingProfessor) {
                throw new AppError_1.AppError("Já existe um professor com este e-mail.", 409);
            }
            const courseObjects = yield Course_1.Course.find({ _id: { $in: courses } });
            if (courseObjects.length !== courses.length) {
                throw new AppError_1.AppError("Um ou mais cursos não foram encontrados.", 404);
            }
            const hashedPassword = yield (0, bcryptjs_1.hash)(password, 10);
            const newProfessor = yield Professor_1.Professor.create({
                name,
                email,
                password: hashedPassword,
                role: ["professor"],
                school,
                courses: courses.map((courseId) => new mongoose_1.Types.ObjectId(courseId)),
            });
            for (const course of courseObjects) {
                if (!course.professors.includes(newProfessor._id)) {
                    course.professors.push(newProfessor._id);
                    yield course.save();
                }
            }
            return newProfessor;
        });
    }
}
exports.CreateProfessorService = CreateProfessorService;
