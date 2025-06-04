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
exports.UpdatePasswordService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../../models/User");
const Professor_1 = require("../../models/Professor");
const mongoose_1 = __importDefault(require("mongoose"));
class UpdatePasswordService {
    updatePassword(userId, currentPassword, newPassword, role) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw new Error("ID inválido.");
            }
            let userDetails;
            if (role === "professor") {
                userDetails = yield Professor_1.Professor.findById(userId).select("password").lean();
            }
            else if (role === "student" || role === "admin") {
                userDetails = yield User_1.User.findById(userId).select("password").lean();
            }
            else {
                throw new Error("Papel inválido!");
            }
            if (!userDetails) {
                throw new Error("Usuário não encontrado.");
            }
            const isPasswordValid = yield bcryptjs_1.default.compare(currentPassword, userDetails.password || "");
            if (!isPasswordValid) {
                throw new Error("Senha atual incorreta.");
            }
            const hashedPassword = yield bcryptjs_1.default.hash(newPassword, 10);
            if (role === "professor") {
                yield Professor_1.Professor.findByIdAndUpdate(userId, { password: hashedPassword });
            }
            else {
                yield User_1.User.findByIdAndUpdate(userId, { password: hashedPassword });
            }
        });
    }
}
exports.UpdatePasswordService = UpdatePasswordService;
