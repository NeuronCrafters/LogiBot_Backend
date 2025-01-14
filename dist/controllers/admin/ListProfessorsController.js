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
exports.ListProfessorsController = void 0;
const ListProfessorsService_1 = require("../../services/admin/ListProfessorsService");
class ListProfessorsController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const listProfessorsService = new ListProfessorsService_1.ListProfessorsService();
            try {
                const userRole = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
                if (userRole !== "admin") {
                    return res.status(403).json({ error: "Acesso negado. Apenas administradores podem acessar." });
                }
                const professors = yield listProfessorsService.execute();
                return res.json(professors);
            }
            catch (error) {
                return res.status(500).json({ error: error.message });
            }
        });
    }
}
exports.ListProfessorsController = ListProfessorsController;
