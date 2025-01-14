"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthorized = isAuthorized;
const AppError_1 = require("../exceptions/AppError");
function isAuthorized(role) {
    return (req, res, next) => {
        var _a;
        const userRole = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
        if (userRole !== role) {
            throw new AppError_1.AppError("Acesso negado. Você não tem permissão.", 403);
        }
        next();
    };
}
