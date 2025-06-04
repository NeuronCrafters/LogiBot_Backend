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
exports.LogsClassComparisonService = LogsClassComparisonService;
const UserAnalysis_1 = require("../../../models/UserAnalysis");
const TimeFormatter_1 = require("../../../utils/TimeFormatter");
const Class_1 = require("../../../models/Class");
function LogsClassComparisonService(classId1, classId2) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Comparando turmas:", classId1, classId2);
        // Buscar informações das turmas para verificar se são do mesmo curso
        const class1 = yield Class_1.Class.findById(classId1);
        const class2 = yield Class_1.Class.findById(classId2);
        if (!class1 || !class2) {
            throw new Error("Uma ou ambas as turmas não foram encontradas.");
        }
        // Corrigido: usando course em vez de courseId
        if (!class1.course.equals(class2.course)) {
            throw new Error("As turmas não pertencem ao mesmo curso.");
        }
        // Busca dados das duas turmas
        const class1Data = yield fetchClassData(classId1);
        const class2Data = yield fetchClassData(classId2);
        return {
            class1: class1Data,
            class2: class2Data
        };
    });
}
function fetchClassData(classId) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield UserAnalysis_1.UserAnalysis.find({ classId });
        console.log(`Encontrados ${users.length} registros para turma ${classId}`);
        // Se não há usuários, retorna zeros
        if (users.length === 0) {
            return {
                totalCorrectAnswers: 0,
                totalWrongAnswers: 0,
                usageTimeInSeconds: 0,
                usageTime: {
                    totalSeconds: 0,
                    formatted: "00:00:00",
                    humanized: "0s",
                    hours: 0,
                    minutes: 0,
                    seconds: 0
                },
                subjectCounts: {
                    variaveis: 0,
                    tipos: 0,
                    funcoes: 0,
                    loops: 0,
                    verificacoes: 0
                }
            };
        }
        let totalCorrectAnswers = 0;
        let totalWrongAnswers = 0;
        let totalUsageTime = 0;
        const subjectCounts = {
            variaveis: 0,
            tipos: 0,
            funcoes: 0,
            loops: 0,
            verificacoes: 0
        };
        users.forEach((ua) => {
            var _a, _b;
            totalCorrectAnswers += ((_a = ua.totalCorrectWrongAnswers) === null || _a === void 0 ? void 0 : _a.totalCorrectAnswers) || 0;
            totalWrongAnswers += ((_b = ua.totalCorrectWrongAnswers) === null || _b === void 0 ? void 0 : _b.totalWrongAnswers) || 0;
            totalUsageTime += ua.totalUsageTime || 0;
            if (ua.subjectCountsQuiz && typeof ua.subjectCountsQuiz === 'object') {
                if (typeof ua.subjectCountsQuiz.variaveis === 'number')
                    subjectCounts.variaveis += ua.subjectCountsQuiz.variaveis;
                if (typeof ua.subjectCountsQuiz.tipos === 'number')
                    subjectCounts.tipos += ua.subjectCountsQuiz.tipos;
                if (typeof ua.subjectCountsQuiz.funcoes === 'number')
                    subjectCounts.funcoes += ua.subjectCountsQuiz.funcoes;
                if (typeof ua.subjectCountsQuiz.loops === 'number')
                    subjectCounts.loops += ua.subjectCountsQuiz.loops;
                if (typeof ua.subjectCountsQuiz.verificacoes === 'number')
                    subjectCounts.verificacoes += ua.subjectCountsQuiz.verificacoes;
            }
        });
        const usageTimeObj = (0, TimeFormatter_1.calculateUsageTime)(totalUsageTime);
        return {
            totalCorrectAnswers,
            totalWrongAnswers,
            usageTimeInSeconds: totalUsageTime,
            usageTime: usageTimeObj,
            subjectCounts,
            userCount: users.length
        };
    });
}
