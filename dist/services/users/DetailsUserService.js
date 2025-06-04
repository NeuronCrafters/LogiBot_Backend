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
exports.DetailsUserService = void 0;
const AppError_1 = require("../../exceptions/AppError");
const User_1 = require("../../models/User");
const Professor_1 = require("../../models/Professor");
class DetailsUserService {
    detailsUser(user_id, role) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const roles = Array.isArray(role) ? role : [role];
            const isCoordinator = roles.includes("course-coordinator");
            const isProfessor = roles.includes("professor");
            const isStudent = roles.includes("student");
            const isAdmin = roles.includes("admin");
            let raw = null;
            if (isCoordinator || isProfessor) {
                raw = yield Professor_1.Professor.findById(user_id)
                    .select("name email role school courses disciplines")
                    .populate({ path: "school", select: "name" })
                    .populate({ path: "courses", select: "name" })
                    .lean();
            }
            else if (isStudent || isAdmin) {
                raw = yield User_1.User.findById(user_id)
                    .select("name email role school course class")
                    .populate({ path: "school", select: "name" })
                    .populate({ path: "course", select: "name" })
                    .populate({ path: "class", select: "name" })
                    .lean();
            }
            else {
                throw new AppError_1.AppError("Papel inválido!", 400);
            }
            if (!raw) {
                throw new AppError_1.AppError("Usuário não encontrado!", 404);
            }
            const out = {
                _id: String(raw._id),
                name: raw.name,
                email: raw.email,
                role: Array.isArray(raw.role) ? raw.role : [raw.role],
                schoolId: String((_a = raw.school) === null || _a === void 0 ? void 0 : _a._id),
                schoolName: (_c = (_b = raw.school) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : "",
                courseId: raw.course ? String(raw.course._id) : undefined,
                courseName: raw.course ? raw.course.name : undefined,
                classId: raw.class ? String(raw.class._id) : undefined,
                className: raw.class ? raw.class.name : undefined,
                courses: raw.courses
                    ? raw.courses.map(c => ({ id: String(c._id), name: c.name }))
                    : undefined,
                disciplines: raw.disciplines,
            };
            return out;
        });
    }
}
exports.DetailsUserService = DetailsUserService;
