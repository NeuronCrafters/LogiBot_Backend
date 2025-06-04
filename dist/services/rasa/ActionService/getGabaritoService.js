"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGabaritoService = getGabaritoService;
function getGabaritoService(session) {
    return {
        answer_keys: session.lastAnswerKeys,
        assunto: session.lastSubject,
    };
}
