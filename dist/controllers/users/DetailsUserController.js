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
const AppError_1 = require("../../exceptions/AppError");
const DetailsUserService_1 = require("../../services/users/DetailsUserService");
function getPrimaryRole(roles) {
    const priority = ["admin", "course-coordinator", "professor", "student"];
    if (Array.isArray(roles)) {
        for (const r of priority)
            if (roles.includes(r))
                return r;
        return roles[0];
    }
    return roles;
}
class DetailsUserController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, role } = req.user;
                const primaryRole = getPrimaryRole(role);
                const svc = new DetailsUserService_1.DetailsUserService();
                const userDetails = yield svc.detailsUser(id, primaryRole);
                return res.json(userDetails);
            }
            catch (err) {
                console.error(err);
                const status = err instanceof AppError_1.AppError ? err.statusCode : 500;
                return res.status(status).json({ error: err.message });
            }
        });
    }
}
exports.DetailsUserController = DetailsUserController;
