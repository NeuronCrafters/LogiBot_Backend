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
exports.AuthUserService = void 0;
const User_1 = require("../../models/User");
const Professor_1 = require("../../models/Professor");
const University_1 = require("../../models/University");
const Course_1 = require("../../models/Course");
const Class_1 = require("../../models/Class");
const UserAnalysis_1 = require("../../models/UserAnalysis");
const bcryptjs_1 = require("bcryptjs");
const jsonwebtoken_1 = require("jsonwebtoken");
const AppError_1 = require("../../exceptions/AppError");
function normalizeRoles(roleField) {
    if (!roleField)
        return [];
    if (Array.isArray(roleField))
        return roleField.filter(Boolean);
    return [roleField];
}
function prioritizeRole(roles) {
    if (roles.includes("course-coordinator")) {
        return ["course-coordinator"];
    }
    return roles;
}
class AuthUserService {
    signin(_a) {
        return __awaiter(this, arguments, void 0, function* ({ email, password, googleId }) {
            const isSocial = !!googleId;
            let user = isSocial
                ? yield User_1.User.findOne({ googleId })
                : yield User_1.User.findOne({ email });
            if (!user) {
                user = isSocial
                    ? yield Professor_1.Professor.findOne({ googleId })
                    : yield Professor_1.Professor.findOne({ email });
            }
            if (!user)
                throw new AppError_1.AppError("Credenciais inválidas.", 401);
            // verifica senha se for login normal
            if (!isSocial) {
                if (!password)
                    throw new AppError_1.AppError("Senha não fornecida.", 400);
                if (!user.password)
                    throw new AppError_1.AppError("Usuário sem senha cadastrada.", 401);
                const match = yield (0, bcryptjs_1.compare)(password, user.password);
                if (!match)
                    throw new AppError_1.AppError("Credenciais inválidas.", 401);
            }
            if (normalizeRoles(user.role).includes("student")) {
                let ua = yield UserAnalysis_1.UserAnalysis.findOne({ userId: user._id.toString() });
                if (!ua) {
                    const schoolDoc = yield University_1.University.findById(user.school);
                    const courseDoc = yield Course_1.Course.findById(user.course);
                    const classDoc = yield Class_1.Class.findById(user.class);
                    ua = new UserAnalysis_1.UserAnalysis({
                        userId: user._id.toString(),
                        name: user.name,
                        email: user.email,
                        schoolId: user.school,
                        schoolName: (schoolDoc === null || schoolDoc === void 0 ? void 0 : schoolDoc.name) || "",
                        courseId: user.course,
                        courseName: (courseDoc === null || courseDoc === void 0 ? void 0 : courseDoc.name) || "",
                        classId: user.class,
                        className: (classDoc === null || classDoc === void 0 ? void 0 : classDoc.name) || "",
                        totalUsageTime: 0,
                        totalCorrectWrongAnswers: {
                            totalCorrectAnswers: 0,
                            totalWrongAnswers: 0,
                        },
                        subjectCountsQuiz: {
                            variaveis: 0,
                            tipos: 0,
                            funcoes: 0,
                            loops: 0,
                            verificacoes: 0,
                        },
                        sessions: [
                            {
                                sessionStart: new Date(),
                                totalCorrectAnswers: 0,
                                totalWrongAnswers: 0,
                                subjectCountsChat: (0, UserAnalysis_1.getEmptySubjectCounts)(),
                                answerHistory: [],
                            },
                        ],
                    });
                    yield ua.save();
                }
                else {
                    const last = ua.sessions.at(-1);
                    if (last.sessionEnd) {
                        ua.sessions.push({
                            sessionStart: new Date(),
                            totalCorrectAnswers: 0,
                            totalWrongAnswers: 0,
                            subjectCountsChat: (0, UserAnalysis_1.getEmptySubjectCounts)(),
                            answerHistory: [],
                        });
                        yield ua.save();
                    }
                }
            }
            const roles = prioritizeRole(normalizeRoles(user.role));
            const token = (0, jsonwebtoken_1.sign)({
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: roles,
                school: user.school,
                course: user.course,
                class: user.class,
            }, process.env.JWT_SECRET, {
                subject: user._id.toString(),
                expiresIn: "1d",
            });
            return {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: roles,
                school: user.school,
                courses: user.course,
                classes: user.class,
                sessionStart: new Date(),
                token,
            };
        });
    }
    logout(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userAnalysis = yield UserAnalysis_1.UserAnalysis.findOne({ userId });
                if (userAnalysis && userAnalysis.sessions.length > 0) {
                    const lastSession = userAnalysis.sessions[userAnalysis.sessions.length - 1];
                    if (!lastSession.sessionEnd) {
                        lastSession.sessionEnd = new Date();
                        lastSession.sessionDuration =
                            (lastSession.sessionEnd.getTime() - lastSession.sessionStart.getTime()) / 1000;
                        yield userAnalysis.save();
                        console.log(`[UserAnalysis] Sessão encerrada para usuário: ${userId}`);
                    }
                    else {
                        console.log(`[UserAnalysis] Nenhuma sessão ativa encontrada para ${userId}`);
                    }
                }
            }
            catch (error) {
                console.error("[UserAnalysis] Erro ao encerrar sessão:", error);
            }
        });
    }
}
exports.AuthUserService = AuthUserService;
