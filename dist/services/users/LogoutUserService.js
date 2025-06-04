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
exports.LogoutUserService = void 0;
const User_1 = require("../../models/User");
const Professor_1 = require("../../models/Professor");
const UserAnalysis_1 = require("../../models/UserAnalysis");
const AppError_1 = require("../../exceptions/AppError");
function normalizeRoles(roleField) {
    if (!roleField)
        return [];
    if (Array.isArray(roleField))
        return roleField.filter(Boolean);
    return [roleField];
}
class LogoutUserService {
    logout(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!userId) {
                throw new AppError_1.AppError("O 'userId' é obrigatório para realizar o logout.", 400);
            }
            // buscar o usuário e identificar o papel
            const user = (yield User_1.User.findById(userId)) ||
                (yield Professor_1.Professor.findById(userId));
            if (!user) {
                throw new AppError_1.AppError("Usuário não encontrado.", 404);
            }
            const roles = normalizeRoles(user.role);
            // se o usuário não for um estudante, apenas finaliza o logout sem erro
            if (!roles.includes("student")) {
                console.log(`[LOGOUT] Usuário ${user.email} não é estudante. Logout simples efetuado.`);
                return {
                    message: "Logout efetuado (sem análise de sessão).",
                    sessionEnd: null,
                    sessionDuration: null,
                    totalUsageTime: null,
                };
            }
            // lgica normal de logout para estudantes 
            console.log(`[LOGOUT] Buscando UserAnalysis para userId: ${userId}`);
            const userAnalysis = yield UserAnalysis_1.UserAnalysis.findOne({ userId });
            if (!userAnalysis || userAnalysis.sessions.length === 0) {
                throw new AppError_1.AppError("Nenhuma sessão ativa encontrada para este estudante.", 404);
            }
            const lastSession = userAnalysis.sessions[userAnalysis.sessions.length - 1];
            if (lastSession.sessionEnd) {
                throw new AppError_1.AppError("Este estudante já está deslogado.", 400);
            }
            if (!lastSession.sessionStart) {
                throw new AppError_1.AppError("A sessão não possui uma data de início válida.", 400);
            }
            lastSession.sessionEnd = new Date();
            lastSession.sessionDuration =
                (lastSession.sessionEnd.getTime() - lastSession.sessionStart.getTime()) / 1000;
            const totalUsageTime = userAnalysis.sessions.reduce((acc, session) => {
                return acc + (session.sessionDuration || 0);
            }, 0);
            userAnalysis.totalUsageTime = totalUsageTime;
            try {
                yield userAnalysis.save();
                console.log(`[LOGOUT] Sessão encerrada com sucesso para estudante: ${user.email}`);
            }
            catch (error) {
                console.error(`[LOGOUT] Erro ao salvar UserAnalysis:`, error);
                throw new AppError_1.AppError("Erro ao salvar a sessão: " + error.message, 500);
            }
            return {
                message: "Sessão encerrada com sucesso.",
                sessionEnd: lastSession.sessionEnd,
                sessionDuration: lastSession.sessionDuration,
                totalUsageTime,
            };
        });
    }
}
exports.LogoutUserService = LogoutUserService;
