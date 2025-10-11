import cron from "node-cron";
import { UserAnalysis } from "../models/UserAnalysis";
import { LogoutUserService } from "../services/users/LogoutUserService";

const INACTIVITY_TIMEOUT_MINUTES = 10;

async function findAndLogoutInactiveUsers() {
    console.log(`[CRON JOB] Executando verificação de sessões inativas...`);

    const logoutService = new LogoutUserService();
    const timeoutLimit = new Date(Date.now() - INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);

    try {
        const analysesWithInactiveSessions = await UserAnalysis.find({
            "sessions.sessionEnd": null,
            "sessions.lastActivityAt": { $lt: timeoutLimit }
        });

        if (analysesWithInactiveSessions.length === 0) {
            return;
        }

        console.log(`[CRON JOB] Encontradas ${analysesWithInactiveSessions.length} sessões inativas. Iniciando processo de logout...`);

        for (const analysis of analysesWithInactiveSessions) {
            try {
                await logoutService.logout(analysis.userId);
                console.log(`[CRON JOB] Logout automático por inatividade para o usuário ${analysis.email} foi concluído.`);
            } catch (error: any) {
                console.error(`[CRON JOB] Erro ao tentar deslogar usuário ${analysis.userId}: ${error.message}`);
            }
        }
    } catch (error) {
        console.error("[CRON JOB] Erro crítico durante a busca por sessões inativas:", error);
    }
}

export function startSessionCleaner() {
    // a expressão "*/5 * * * *" significa "Execute a cada 5 minutos".
    cron.schedule("*/5 * * * *", findAndLogoutInactiveUsers);

    console.log("✅ Agendador de limpeza de sessão iniciado (verificação de inatividade a cada 5 minutos).");
}