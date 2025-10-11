import cron from "node-cron";
import { UserAnalysis } from "../models/UserAnalysis";
import { LogoutUserService } from "../services/users/LogoutUserService";

// 1. AJUSTE O TEMPO DE INATIVIDADE PARA 0.5 MINUTOS (30 SEGUNDOS)
const INACTIVITY_TIMEOUT_MINUTES = 10;

async function findAndLogoutInactiveUsers() {
    console.log(`[CRON JOB - TESTE] Executando verificação de sessões inativas...`);

    const logoutService = new LogoutUserService();
    const timeoutLimit = new Date(Date.now() - INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);

    try {
        const analysesWithInactiveSessions = await UserAnalysis.find({
            "sessions.sessionEnd": null,
            "sessions.lastActivityAt": { $lt: timeoutLimit }
        });

        if (analysesWithInactiveSessions.length === 0) {
            // Esta mensagem aparecerá a cada 15 segundos enquanto você estiver ativo
            // console.log("[CRON JOB - TESTE] Nenhuma sessão inativa encontrada.");
            return;
        }

        console.log(`[CRON JOB - TESTE] Encontradas ${analysesWithInactiveSessions.length} sessões inativas. Iniciando processo de logout...`);

        for (const analysis of analysesWithInactiveSessions) {
            try {
                await logoutService.logout(analysis.userId);
                console.log(`[CRON JOB - TESTE] Logout automático por inatividade para o usuário ${analysis.email} foi concluído.`);
            } catch (error: any) {
                console.error(`[CRON JOB - TESTE] Erro ao tentar deslogar usuário ${analysis.userId}: ${error.message}`);
            }
        }
    } catch (error) {
        console.error("[CRON JOB - TESTE] Erro crítico durante a busca por sessões inativas:", error);
    }
}

/**
 * Inicia o job agendado.
 */
export function startSessionCleaner() {
    // 2. AJUSTE A FREQUÊNCIA DO JOB PARA CADA 15 SEGUNDOS
    // A expressão "*/15 * * * * *" (com 6 asteriscos) significa "Execute a cada 15 segundos".
    cron.schedule("*/15 * * * * *", findAndLogoutInactiveUsers);
    console.log("✅ Agendador de limpeza de sessão iniciado em MODO DE TESTE (verificação a cada 15 segundos).");
}