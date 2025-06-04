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
exports.LogoutUserController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const LogoutUserService_1 = require("../../services/users/LogoutUserService");
const AppError_1 = require("../../exceptions/AppError");
class LogoutUserController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const token = req.cookies.token;
                if (!token) {
                    throw new AppError_1.AppError("Token não fornecido.", 401);
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                if (!decoded || !decoded.sub) {
                    throw new AppError_1.AppError("Token inválido.", 401);
                }
                const userId = decoded.sub;
                const logoutUserService = new LogoutUserService_1.LogoutUserService();
                const result = yield logoutUserService.logout(userId);
                res.clearCookie("token");
                return res.status(200).json(result);
            }
            catch (error) {
                return res.status(error.statusCode || 500).json({ error: error.message });
            }
        });
    }
}
exports.LogoutUserController = LogoutUserController;
