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
            try {
                let userDetails;
                if (role === "professor") {
                    userDetails = yield Professor_1.Professor.findById(user_id)
                        .select("name email role department")
                        .lean();
                }
                else {
                    userDetails = yield User_1.User.findById(user_id)
                        .select("name email role")
                        .lean();
                }
                if (!userDetails) {
                    throw new AppError_1.AppError("Usuário não encontrado!", 404);
                }
                return userDetails;
            }
            catch (error) {
                console.error("Erro ao buscar detalhes do usuário:", error);
                if (error instanceof AppError_1.AppError) {
                    throw error;
                }
                throw new AppError_1.AppError("Erro interno ao buscar usuário.", 500);
            }
        });
    }
}
exports.DetailsUserService = DetailsUserService;
