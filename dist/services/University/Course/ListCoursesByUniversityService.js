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
exports.ListCoursesByUniversityService = void 0;
const Course_1 = require("../../../models/Course");
const mongoose_1 = require("mongoose");
class ListCoursesByUniversityService {
    execute(universityId) {
        return __awaiter(this, void 0, void 0, function* () {
            const universityObjectId = new mongoose_1.Types.ObjectId(universityId);
            const courses = yield Course_1.Course.find({ university: universityObjectId })
                .populate("professors", "name email")
                .populate("classes", "name")
                .populate("disciplines", "name code");
            return courses;
        });
    }
}
exports.ListCoursesByUniversityService = ListCoursesByUniversityService;
