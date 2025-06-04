"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const AppError_1 = require("../exceptions/AppError");
const errorHandler = (err, _req, res, _next) => {
    console.error(err.stack || err);
    if (err instanceof AppError_1.AppError) {
        return res.status(err.statusCode).json({ error: err.message });
    }
    if (err instanceof mongoose_1.default.Error.ValidationError) {
        const details = Object.values(err.errors).map((e) => e.message);
        return res.status(422).json({
            error: 'Validation error',
            details,
        });
    }
    if (err instanceof mongoose_1.default.Error.CastError) {
        return res.status(400).json({
            error: `Invalid ${err.path}: ${err.value}`,
        });
    }
    if (err instanceof Error) {
        return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
};
exports.errorHandler = errorHandler;
