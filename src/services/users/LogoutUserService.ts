import { User } from "../../models/User";
import { Professor } from "../../models/Professor";
import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";

function normalizeRoles(roleField: string | string[] | null | undefined): string[] {
    if (!roleField) return [];
    if (Array.isArray(roleField)) return roleField.filter(Boolean);
    return [roleField];
}

class LogoutUserService {
    async logout(userId: string) {
        if (!userId) {
            throw new AppError("o 'userid' é obrigatório para realizar o logout.", 400);
        }

        const user =
            (await User.findById(userId)) ||
            (await Professor.findById(userId));

        if (!user) {
            throw new AppError("usuário não encontrado.", 404);
        }

        const roles = normalizeRoles(user.role);

        if (!roles.includes("student")) {

            return {
                message: "Logout efetuado (sem análise de sessão)."
            };
        }


        const userAnalysis = await UserAnalysis.findOne({ userId });

        if (!userAnalysis || userAnalysis.sessions.length === 0) {
            throw new AppError("nenhuma sessão ativa encontrada para este estudante.", 404);
        }

        const lastSession = userAnalysis.sessions.at(-1);

        if (!lastSession || lastSession.sessionEnd) {
            throw new AppError("este estudante já está deslogado.", 400);
        }

        if (!lastSession.sessionStart) {
            throw new AppError("a sessão não possui uma data de início válida.", 400);
        }

        lastSession.sessionEnd = new Date();
        const sessionDuration = (lastSession.sessionEnd.getTime() - lastSession.sessionStart.getTime()) / 1000;
        lastSession.sessionDuration = sessionDuration;

        userAnalysis.totalUsageTime = (userAnalysis.totalUsageTime || 0) + sessionDuration;

        try {
            await userAnalysis.save();

        } catch (error: any) {

            throw new AppError("erro ao salvar a sessão:" + error.message, 500);
        }

        return {
            message: "Sessão encerrada com sucesso.",
            sessionEnd: lastSession.sessionEnd,
            sessionDuration: lastSession.sessionDuration,
            totalUsageTime: userAnalysis.totalUsageTime,
        };
    }
}

export { LogoutUserService };