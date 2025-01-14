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
exports.DetailsUserController = void 0;
const DetailsUserService_1 = require("../../services/users/DetailsUserService");
class DetailsUserController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, role } = req.user;
                const detailsUserService = new DetailsUserService_1.DetailsUserService();
                const userDetails = yield detailsUserService.detailsUser(id, role);
                return res.json(userDetails);
            }
            catch (error) {
                console.error("Erro ao buscar detalhes do usuário:", error);
                return res.status(error.statusCode || 500).json({ error: error.message });
            }
        });
    }
}
exports.DetailsUserController = DetailsUserController;
