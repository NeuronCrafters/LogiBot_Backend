"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode = 400, cause) {
        super(message);
        this.statusCode = statusCode;
        this.cause = cause;
    }
}
exports.AppError = AppError;
