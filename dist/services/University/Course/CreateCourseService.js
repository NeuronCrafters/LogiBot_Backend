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
exports.CreateCourseService = void 0;
const Course_1 = require("../../../models/Course");
const University_1 = require("../../../models/University");
const AppError_1 = require("../../../exceptions/AppError");
const mongoose_1 = require("mongoose");
class CreateCourseService {
    execute(name, universityId) {
        return __awaiter(this, void 0, void 0, function* () {
            const universityObjectId = new mongoose_1.Types.ObjectId(universityId);
            const university = yield University_1.University.findById(universityObjectId);
            if (!university) {
                throw new AppError_1.AppError("Universidade não encontrada!", 404);
            }
            const existingCourse = yield Course_1.Course.findOne({ name, university: universityObjectId });
            if (existingCourse) {
                throw new AppError_1.AppError("Curso já existe para esta universidade!", 409);
            }
            const course = yield Course_1.Course.create({ name, university: universityObjectId });
            university.courses.push(course._id);
            yield university.save();
            return course;
        });
    }
}
exports.CreateCourseService = CreateCourseService;
