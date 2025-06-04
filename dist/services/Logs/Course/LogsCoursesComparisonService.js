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
exports.LogsCoursesComparisonService = LogsCoursesComparisonService;
const UserAnalysis_1 = require("../../../models/UserAnalysis");
const TimeFormatter_1 = require("../../../utils/TimeFormatter");
function LogsCoursesComparisonService(courseId1, courseId2) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Comparando cursos:", courseId1, courseId2);
        // Busca dados dos dois cursos
        const course1Data = yield fetchCourseData(courseId1);
        const course2Data = yield fetchCourseData(courseId2);
        return {
            course1: course1Data,
            course2: course2Data
        };
    });
}
function fetchCourseData(courseId) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield UserAnalysis_1.UserAnalysis.find({ courseId });
        console.log(`Encontrados ${users.length} registros para curso ${courseId}`);
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
