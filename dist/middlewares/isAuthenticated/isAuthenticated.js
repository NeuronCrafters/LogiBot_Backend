"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = isAuthenticated;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function normalizeRoles(roleField) {
    if (!roleField)
        return [];
    if (Array.isArray(roleField))
        return roleField.filter(Boolean);
    return [roleField];
}
function isAuthenticated(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: "Não autenticado: token ausente" });
    }
    try {
        const secret = process.env.JWT_SECRET || "default_secret";
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        req.user = {
            id: decoded.sub,
            name: decoded.name,
            email: decoded.email,
            role: normalizeRoles(decoded.role),
            school: decoded.school || null,
        };
        return next();
    }
    catch (error) {
        return res.status(401).json({ error: "Token inválido." });
    }
}
