"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = isAuthenticated;
const jsonwebtoken_1 = require("jsonwebtoken");
function isAuthenticated(req, res, next) {
    const authToken = req.headers.authorization;
    if (!authToken) {
        return res.status(401).json({ error: "Token não fornecido." });
    }
    const [, token] = authToken.split(" ");
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error("JWT_SECRET não está definida nas variáveis de ambiente.");
        }
        const { sub, role, school } = (0, jsonwebtoken_1.verify)(token, secret);
        req.user = { id: sub, role, school };
        return next();
    }
    catch (error) {
        console.error("Erro de autenticação:", error);
        return res.status(401).json({ error: "Token inválido." });
    }
}
