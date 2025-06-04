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
exports.LogsUniversitySummaryService = LogsUniversitySummaryService;
const UserAnalysis_1 = require("../../../models/UserAnalysis");
const TimeFormatter_1 = require("../../../utils/TimeFormatter");
function LogsUniversitySummaryService(universityId) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Buscando resumo para universidade:", universityId);
        const users = yield UserAnalysis_1.UserAnalysis.find({ schoolId: universityId });
        console.log(`Encontrados ${users.length} registros de análise de usuários para universidade`);
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
                },
                // Adicionando arrays vazios para o caso de não ter usuários
                sessions: [],
                dailyUsage: []
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
        // Array para armazenar todas as sessões de todos os usuários
        const allSessions = [];
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
            // Coleta todas as sessões completas (com início e fim) do usuário
            if (ua.sessions && Array.isArray(ua.sessions)) {
                ua.sessions.forEach(session => {
                    if (session.sessionStart && session.sessionEnd && session.sessionDuration) {
                        allSessions.push({
                            sessionStart: session.sessionStart,
                            sessionEnd: session.sessionEnd,
                            sessionDuration: session.sessionDuration,
                            userId: ua.userId,
                            userName: ua.name,
                            courseName: ua.courseName || "",
                            className: ua.className || ""
                        });
                    }
                });
            }
        });
        const usageTimeObj = (0, TimeFormatter_1.calculateUsageTime)(totalUsageTime);
        // Processa as sessões para o formato esperado pelo front-end
        const processedSessions = allSessions
            // Ordena as sessões por data (mais recentes primeiro)
            .sort((a, b) => b.sessionStart.getTime() - a.sessionStart.getTime())
            // Formata os dados para o front-end
            .map(session => {
            // Converte a duração em segundos para minutos para o gráfico
            const durationInMinutes = session.sessionDuration / 60;
            // Formata a duração para exibição (HH:MM:SS)
            const formattedDuration = (0, TimeFormatter_1.calculateUsageTime)(session.sessionDuration).formatted;
            // Extrai a data sem o horário para agrupar por dia
            const date = session.sessionStart.toISOString().split('T')[0];
            return {
                date,
                sessionStart: session.sessionStart,
                sessionEnd: session.sessionEnd,
                sessionDuration: session.sessionDuration,
                durationInMinutes,
                usage: durationInMinutes, // Para compatibilidade com o componente de gráfico existente
                formatted: formattedDuration,
                userId: session.userId,
                userName: session.userName,
                courseName: session.courseName,
                className: session.className
            };
        });
        // Agrupa as sessões por dia para o gráfico de uso diário
        const sessionsByDay = {};
        processedSessions.forEach(session => {
            if (!sessionsByDay[session.date]) {
                sessionsByDay[session.date] = {
                    date: session.date,
                    usage: 0,
                    formatted: "00:00:00",
                    sessions: []
                };
            }
            // Adiciona a duração desta sessão ao total do dia
            sessionsByDay[session.date].usage += session.usage;
            // Adiciona a sessão à lista de sessões do dia
            sessionsByDay[session.date].sessions.push(session);
            // Recalcula o tempo formatado total do dia
            const totalSecondsForDay = sessionsByDay[session.date].usage * 60; // Converte minutos para segundos
            sessionsByDay[session.date].formatted = (0, TimeFormatter_1.calculateUsageTime)(totalSecondsForDay).formatted;
        });
        // Converte o objeto agrupado em um array para o gráfico
        const dailyUsage = Object.values(sessionsByDay)
            // Ordena por data (mais recentes primeiro)
            .sort((a, b) => b.date.localeCompare(a.date))
            // Limita aos últimos 30 dias
            .slice(0, 30);
        return {
            totalCorrectAnswers,
            totalWrongAnswers,
            usageTimeInSeconds: totalUsageTime,
            usageTime: usageTimeObj,
            subjectCounts,
            // Adiciona os dados de sessão agrupados por dia
            dailyUsage,
            // Adiciona todas as sessões individuais
            sessions: processedSessions
        };
    });
}
