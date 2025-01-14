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
exports.ViewStudentHistoryService = void 0;
const History_1 = require("../../models/History");
class ViewStudentHistoryService {
    execute(studentId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const historyRecords = yield History_1.History.find({ student: studentId });
                if (!historyRecords || historyRecords.length === 0) {
                    throw new Error("Histórico não encontrado.");
                }
                return historyRecords.map((history) => ({
                    content: history.content,
                    date: history.date,
                }));
            }
            catch (error) {
                throw new Error("Erro ao buscar histórico do aluno.");
            }
        });
    }
}
exports.ViewStudentHistoryService = ViewStudentHistoryService;
