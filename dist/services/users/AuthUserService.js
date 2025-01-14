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
const bcryptjs_1 = require("bcryptjs");
const jsonwebtoken_1 = require("jsonwebtoken");
const AppError_1 = require("../../exceptions/AppError");
class AuthUserService {
    signin(_a) {
        return __awaiter(this, arguments, void 0, function* ({ email, password, googleId }) {
            const isSocialLogin = googleId != null;
            let user = isSocialLogin
                ? yield User_1.User.findOne({ googleId })
                : yield User_1.User.findOne({ email });
            if (!user) {
                user = isSocialLogin
                    ? yield Professor_1.Professor.findOne({ googleId })
                    : yield Professor_1.Professor.findOne({ email });
            }
            if (!user) {
                throw new AppError_1.AppError("Credenciais inválidas.", 401);
            }
            if (isSocialLogin) {
                const token = (0, jsonwebtoken_1.sign)({
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    school: user.school,
                }, process.env.JWT_SECRET, {
                    subject: user._id.toString(),
                    expiresIn: "1d",
                });
                return {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    school: user.school,
                    token,
                    redirectTo: "/sael/talk",
                };
            }
            if (!user.password) {
                throw new AppError_1.AppError("Usuário com erros nas credenciais!", 401);
            }
            const passwordMatch = yield (0, bcryptjs_1.compare)(password, user.password);
            if (!passwordMatch) {
                throw new AppError_1.AppError("Credenciais inválidas.", 401);
            }
            const token = (0, jsonwebtoken_1.sign)({
                name: user.name,
                email: user.email,
                role: user.role,
                school: user.school,
            }, process.env.JWT_SECRET, {
                subject: user._id.toString(),
                expiresIn: "1d",
            });
            return {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                school: user.school,
                token,
            };
        });
    }
}
exports.AuthUserService = AuthUserService;
