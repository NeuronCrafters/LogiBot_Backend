import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";

class LogoutUserService {
  async logout(userId: string) {
    if (!userId) {
      throw new AppError("O 'userId' é obrigatório para realizar o logout.", 400);
    }

    console.log(`[LOGOUT] Buscando UserAnalysis para userId: ${userId}`);

    const userAnalysis = await UserAnalysis.findOne({ userId });

    if (!userAnalysis || userAnalysis.sessions.length === 0) {
      throw new AppError("Nenhuma sessão ativa encontrada para este usuário.", 404);
    }

    console.log(`[LOGOUT] UserAnalysis encontrado:`, userAnalysis);

    // obter a última sessão ativa
    const lastSession = userAnalysis.sessions[userAnalysis.sessions.length - 1];

    console.log(`[LOGOUT] Última sessão encontrada:`, lastSession);

    if (lastSession.sessionEnd) {
      throw new AppError("Este usuário já está deslogado.", 400);
    }

    // validar campos obrigatórios
    if (!lastSession.sessionStart) {
      throw new AppError("A sessão não possui uma data de início válida.", 400);
    }

    // definir o término da sessão e calcular a duração
    lastSession.sessionEnd = new Date();
    lastSession.sessionDuration =
      (lastSession.sessionEnd.getTime() - lastSession.sessionStart.getTime()) / 1000;

    console.log(`[LOGOUT] Sessão finalizada. sessionEnd: ${lastSession.sessionEnd}, sessionDuration: ${lastSession.sessionDuration}`);

    // calcular tempo total de uso do usuário
    const totalUsageTime = userAnalysis.sessions.reduce((acc, session) => {
      return acc + (session.sessionDuration || 0);
    }, 0);

    console.log(`[LOGOUT] Tempo total de uso calculado: ${totalUsageTime} segundos`);

    // atualizar o tempo total de uso no documento
    userAnalysis.totalUsageTime = totalUsageTime;

    try {
      console.log(`[LOGOUT] Tentando salvar UserAnalysis...`);
      await userAnalysis.save();
      console.log(`[LOGOUT] UserAnalysis salvo com sucesso.`);
    } catch (error) {
      console.error(`[LOGOUT] Erro ao salvar UserAnalysis:`, error);
      throw new AppError("Erro ao salvar a sessão: " + error.message, 500);
    }

    console.log(`[LOGOUT] Sessão encerrada para usuário: ${userId}`);

    return {
      message: "Sessão encerrada com sucesso.",
      sessionEnd: lastSession.sessionEnd,
      sessionDuration: lastSession.sessionDuration,
      totalUsageTime,
    };
  }
}

export { LogoutUserService };