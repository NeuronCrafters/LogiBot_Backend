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
exports.CreateClassService = void 0;
const Class_1 = require("../../../models/Class");
const Course_1 = require("../../../models/Course");
const AppError_1 = require("../../../exceptions/AppError");
const mongoose_1 = require("mongoose");
class CreateClassService {
    execute(name, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            const courseObjectId = new mongoose_1.Types.ObjectId(courseId);
            const course = yield Course_1.Course.findById(courseObjectId);
            if (!course) {
                throw new AppError_1.AppError("Curso não encontrado!", 404);
            }
            const existingClass = yield Class_1.Class.findOne({ name, course: courseObjectId });
            if (existingClass) {
                throw new AppError_1.AppError("Turma já existe para este curso!", 409);
            }
            const classData = yield Class_1.Class.create({ name, course: courseObjectId });
            course.classes.push(classData._id);
            yield course.save();
            return classData;
        });
    }
}
exports.CreateClassService = CreateClassService;
