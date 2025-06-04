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
exports.UpdateProfileService = void 0;
const bcryptjs_1 = require("bcryptjs");
const AppError_1 = require("../../exceptions/AppError");
const User_1 = require("../../models/User");
class UpdateProfileService {
    updateProfile(_a) {
        return __awaiter(this, arguments, void 0, function* ({ userId, name, email, password }) {
            const user = yield User_1.User.findById(userId);
            if (!user) {
                throw new AppError_1.AppError("Usuário não encontrado!", 404);
            }
            if (email && email !== user.email) {
                const emailExists = yield User_1.User.findOne({ email });
                if (emailExists) {
                    throw new AppError_1.AppError("Email já está em uso por outro usuário!", 409);
                }
            }
            if (name !== undefined)
                user.name = name;
            if (email !== undefined)
                user.email = email;
            if (password !== undefined)
                user.password = yield (0, bcryptjs_1.hash)(password, 10);
            yield user.save();
            return {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            };
        });
    }
}
exports.UpdateProfileService = UpdateProfileService;
