"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSession = getSession;
const sessionMap = new Map();
function getSession(userId) {
    if (!sessionMap.has(userId)) {
        sessionMap.set(userId, {
            nivelAtual: null,
            lastAnswerKeys: [],
            lastSubject: null,
            lastQuestions: [],
        });
    }
    return sessionMap.get(userId);
}
