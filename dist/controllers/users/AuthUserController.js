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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthUserController = void 0;
const AuthUserService_1 = require("../../services/users/AuthUserService");
const AppError_1 = require("../../exceptions/AppError");
class AuthUserController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password, googleId } = req.body;
                const authUserService = new AuthUserService_1.AuthUserService();
                const result = yield authUserService.signin({ email, password, googleId });
                const { token } = result, userData = __rest(result, ["token"]);
                res.cookie("token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "lax",
                    maxAge: 1000 * 60 * 60 * 24, // 1 dia
                });
                return res.json(userData);
            }
            catch (error) {
                if (error instanceof AppError_1.AppError) {
                    return res.status(error.statusCode).json({ message: error.message });
                }
                console.error("Erro no AuthUserController:", error);
                return res.status(500).json({
                    message: "Erro interno no servidor.",
                    error: error.message,
                });
            }
        });
    }
    logout(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = req.body;
                if (!userId) {
                    return res.status(400).json({ error: "userId é obrigatório para logout." });
                }
                const authUserService = new AuthUserService_1.AuthUserService();
                yield authUserService.logout(userId);
                res.clearCookie("token");
                return res.json({ message: "Sessão encerrada com sucesso." });
            }
            catch (error) {
                console.error("Erro no logout do AuthUserController:", error);
                return res.status(500).json({
                    message: "Erro interno ao encerrar sessão.",
                    error: error.message,
                });
            }
        });
    }
}
exports.AuthUserController = AuthUserController;
