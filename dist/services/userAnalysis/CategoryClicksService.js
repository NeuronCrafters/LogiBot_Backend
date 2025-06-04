"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCategoryClicksService = updateCategoryClicksService;
const UserAnalysis_1 = require("../../models/UserAnalysis");
const normalizeSubject_1 = require("../../utils/normalizeSubject");
function updateCategoryClicksService(userId, clicks) {
    return __awaiter(this, void 0, void 0, function* () {
        const ua = yield UserAnalysis_1.UserAnalysis.findOne({ userId });
        if (!ua) {
            throw new Error(`UserAnalysis não encontrado para userId=${userId}`);
        }
        for (const [rawSubject, count] of Object.entries(clicks)) {
            const categoryKey = (0, normalizeSubject_1.normalizeSubjectFromMessage)(rawSubject) || "tipos";
            for (let i = 0; i < count; i++) {
                ua.updateSubjectCountsQuiz(categoryKey);
            }
        }
        yield ua.save();
    });
}
