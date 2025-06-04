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
exports.UpdateProfileController = void 0;
const UpdateProfileService_1 = require("../../services/users/UpdateProfileService");
class UpdateProfileController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = req.params;
                const { name, email, password } = req.body;
                if (!userId) {
                    return res.status(400).json({
                        message: "O ID do usuário é obrigatório.",
                    });
                }
                const updateProfileService = new UpdateProfileService_1.UpdateProfileService();
                const updatedUser = yield updateProfileService.updateProfile({
                    userId,
                    name,
                    email,
                    password,
                });
                return res.status(200).json({
                    message: "Perfil atualizado com sucesso!",
                    user: updatedUser,
                });
            }
            catch (error) {
                console.error("Erro ao atualizar perfil:", error.message);
                return res.status(error.statusCode || 500).json({
                    message: error.message || "Erro inesperado!",
                });
            }
        });
    }
}
exports.UpdateProfileController = UpdateProfileController;
