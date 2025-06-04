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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignupGoogleService = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const User_1 = require("../../models/User");
const Professor_1 = require("../../models/Professor");
const University_1 = require("../../models/University");
const Course_1 = require("../../models/Course");
const Class_1 = require("../../models/Class");
const Discipline_1 = require("../../models/Discipline");
const domainToSchoolMap_json_1 = __importDefault(require("../../config/socialLogin/domainToSchoolMap.json"));
const AppError_1 = require("../../exceptions/AppError");
const mongoose_1 = require("mongoose");
class SignupGoogleService {
    create(profile) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const email = (_b = (_a = profile.emails) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.value;
            if (!email) {
                throw new AppError_1.AppError("Email não encontrado no perfil do Google.", 400);
            }
            const emailDomain = email.split("@")[1];
            const schoolName = domainToSchoolMap_json_1.default[emailDomain];
            if (!schoolName) {
                throw new AppError_1.AppError("Domínio do email não permitido ou não mapeado.", 403);
            }
            const schoolQuery = mongoose_1.Types.ObjectId.isValid(schoolName)
                ? { _id: schoolName }
                : { name: schoolName };
            const university = yield University_1.University.findOne(schoolQuery);
            if (!university) {
                throw new AppError_1.AppError("Universidade não encontrada.", 404);
            }
            let user = yield User_1.User.findOne({ googleId: profile.id });
            if (!user) {
                const course = yield Course_1.Course.findOne({ university: university._id });
                if (!course) {
                    throw new AppError_1.AppError("Curso padrão para a universidade não encontrado.", 404);
                }
                const classData = yield Class_1.Class.findOne({ course: course._id });
                if (!classData) {
                    throw new AppError_1.AppError("Turma padrão para o curso não encontrada.", 404);
                }
                user = new User_1.User({
                    googleId: profile.id,
                    name: profile.displayName,
                    email,
                    school: university._id,
                    course: course._id,
                    class: classData._id,
                    photo: ((_d = (_c = profile.photos) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.value) || null,
                });
                yield user.save();
                if (!classData.students.includes(user._id)) {
                    classData.students.push(user._id);
                    yield classData.save();
                }
                const disciplines = yield Discipline_1.Discipline.find({ classes: classData._id });
                if (disciplines.length > 0) {
                    const disciplineIds = disciplines.map((discipline) => discipline._id);
                    user.disciplines = disciplineIds;
                    yield user.save();
                    const professorIds = disciplines.flatMap((discipline) => discipline.professors);
                    yield Professor_1.Professor.updateMany({ _id: { $in: professorIds } }, { $addToSet: { students: user._id } });
                    for (const discipline of disciplines) {
                        if (!discipline.students.includes(user._id)) {
                            discipline.students.push(user._id);
                            yield discipline.save();
                        }
                    }
                }
            }
            const secret = process.env.JWT_SECRET || "defaultSecret";
            const token = (0, jsonwebtoken_1.sign)({ sub: user.id, role: user.role }, secret, {
                expiresIn: "1h",
            });
            return { user, token };
        });
    }
}
exports.SignupGoogleService = SignupGoogleService;
