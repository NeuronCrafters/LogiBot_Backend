"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyMiddleware = apiKeyMiddleware;
function apiKeyMiddleware(req, res, next) {
    const key = req.header('x-api-key');
    if (!key || key !== process.env.API_KEY) {
        return res.status(403).json({ message: 'Forbidden: chave inválida' });
    }
    next();
}
