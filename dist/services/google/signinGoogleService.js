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
exports.SigninGoogleService = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const User_1 = require("../../models/User");
class SigninGoogleService {
    login(profile) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const email = (_b = (_a = profile.emails) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.value;
            if (!email) {
                throw new Error('Email não encontrado no perfil do Google.');
            }
            const user = yield User_1.User.findOne({ email });
            if (!user) {
                return { user: null, token: null, message: 'Usuário não encontrado.' };
            }
            const secret = process.env.JWT_SECRET || 'defaultSecret';
            const token = (0, jsonwebtoken_1.sign)({ sub: user.id, role: user.role }, secret, {
                expiresIn: '1h',
            });
            return { user, token, message: null };
        });
    }
}
exports.SigninGoogleService = SigninGoogleService;
