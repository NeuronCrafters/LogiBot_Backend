"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransporter = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const createTransporter = (email, password, domain, port = 587) => {
    return nodemailer_1.default.createTransport({
        host: `smtp.${domain}`,
        port,
        secure: port === 465,
        auth: {
            user: email,
            pass: password,
        },
    });
};
exports.createTransporter = createTransporter;
