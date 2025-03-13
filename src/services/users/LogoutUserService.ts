import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";

class LogoutUserService {
  async logout(userId: string) {
    if (!userId) {
      throw new AppError("O 'userId' é obrigatório para realizar o logout.", 400);
    }

    const userAnalysis = await UserAnalysis.findOne({ userId });

    if (!userAnalysis || userAnalysis.sessions.length === 0) {
      throw new AppError("Nenhuma sessão ativa encontrada para este usuário.", 404);
    }

    // Obter a última sessão ativa
    const lastSession = userAnalysis.sessions[userAnalysis.sessions.length - 1];

    if (lastSession.sessionEnd) {
      throw new AppError("Este usuário já está deslogado.", 400);
    }

    // Definir o término da sessão e calcular a duração
    lastSession.sessionEnd = new Date();
    lastSession.sessionDuration =
      (lastSession.sessionEnd.getTime() - lastSession.sessionStart.getTime()) / 1000;

    // Calcular tempo total de uso do usuário
    const totalUsageTime = userAnalysis.sessions.reduce((acc, session) => {
      return acc + (session.sessionDuration || 0);
    }, 0);

    await userAnalysis.save();

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
