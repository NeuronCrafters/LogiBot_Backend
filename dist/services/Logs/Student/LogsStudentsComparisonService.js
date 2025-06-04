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
exports.LogsStudentsComparisonService = LogsStudentsComparisonService;
const UserAnalysis_1 = require("../../../models/UserAnalysis");
const TimeFormatter_1 = require("../../../utils/TimeFormatter");
function LogsStudentsComparisonService(studentId1, studentId2, classId) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Comparando alunos:", studentId1, studentId2, "da turma:", classId);
        // Busca dados dos dois alunos
        const student1Data = yield fetchStudentData(studentId1, classId);
        const student2Data = yield fetchStudentData(studentId2, classId);
        if (!student1Data || !student2Data) {
            throw new Error("Um ou ambos os alunos não foram encontrados na turma especificada.");
        }
        return {
            student1: student1Data,
            student2: student2Data
        };
    });
}
function fetchStudentData(studentId, classId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const user = yield UserAnalysis_1.UserAnalysis.findOne({
            userId: studentId,
            classId: classId
        });
        console.log(`Análise do aluno ${studentId} na turma ${classId}:`, !!user);
        if (!user) {
            return null;
        }
        const usageTimeObj = (0, TimeFormatter_1.calculateUsageTime)(user.totalUsageTime || 0);
        // Filtrar apenas os assuntos desejados
        const subjectCountsQuiz = {
            variaveis: ((_a = user.subjectCountsQuiz) === null || _a === void 0 ? void 0 : _a.variaveis) || 0,
            tipos: ((_b = user.subjectCountsQuiz) === null || _b === void 0 ? void 0 : _b.tipos) || 0,
            funcoes: ((_c = user.subjectCountsQuiz) === null || _c === void 0 ? void 0 : _c.funcoes) || 0,
            loops: ((_d = user.subjectCountsQuiz) === null || _d === void 0 ? void 0 : _d.loops) || 0,
            verificacoes: ((_e = user.subjectCountsQuiz) === null || _e === void 0 ? void 0 : _e.verificacoes) || 0
        };
        return {
            _id: user._id,
            userId: user.userId,
            name: user.name,
            email: user.email,
            totalCorrectAnswers: ((_f = user.totalCorrectWrongAnswers) === null || _f === void 0 ? void 0 : _f.totalCorrectAnswers) || 0,
            totalWrongAnswers: ((_g = user.totalCorrectWrongAnswers) === null || _g === void 0 ? void 0 : _g.totalWrongAnswers) || 0,
            usageTimeInSeconds: user.totalUsageTime || 0,
            usageTime: usageTimeObj,
            subjectCountsQuiz
        };
    });
}
