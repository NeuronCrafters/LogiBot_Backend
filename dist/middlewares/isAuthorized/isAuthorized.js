"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthorized = isAuthorized;
const AppError_1 = require("../../exceptions/AppError");
function normalizeRoles(roleField) {
    if (!roleField)
        return [];
    if (Array.isArray(roleField))
        return roleField.filter(Boolean);
    return [roleField];
}
function isAuthorized(allowedRoles) {
    return (req, res, next) => {
        var _a;
        const userRoles = normalizeRoles((_a = req.user) === null || _a === void 0 ? void 0 : _a.role);
        if (!allowedRoles.some((role) => userRoles.includes(role))) {
            throw new AppError_1.AppError("Acesso negado. Você não tem permissão.", 403);
        }
        next();
    };
}
