"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mailOptions = void 0;
const mailOptions = (from, to, subject, text) => ({
    from,
    to,
    subject,
    text,
});
exports.mailOptions = mailOptions;
