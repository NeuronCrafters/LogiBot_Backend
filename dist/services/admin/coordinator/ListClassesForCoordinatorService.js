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
exports.ListClassesForCoordinatorService = ListClassesForCoordinatorService;
const Class_1 = require("../../../models/Class");
const Course_1 = require("../../../models/Course");
function ListClassesForCoordinatorService(schoolId, courseId) {
    return __awaiter(this, void 0, void 0, function* () {
        const course = yield Course_1.Course.findOne({
            _id: courseId,
            university: schoolId,
        }).lean();
        if (!course) {
            throw new Error("Curso não pertence à sua universidade.");
        }
        return Class_1.Class.find({ course: courseId }).lean().exec();
    });
}
