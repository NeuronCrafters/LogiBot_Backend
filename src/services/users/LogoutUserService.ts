import { UserAnalysis } from "../../models/UserAnalysis";

class LogoutUserService {
  async logout(userId: string) {
    if (!userId) {
      throw new Error("O 'userId' é obrigatório para realizar o logout.");
    }

    const userAnalysis = await UserAnalysis.findOne({ userId });

    if (!userAnalysis || userAnalysis.sessions.length === 0) {
      throw new Error("Nenhuma sessão ativa encontrada para este usuário.");
    }

    // atualizar a última sessão
    const lastSession = userAnalysis.sessions[userAnalysis.sessions.length - 1];
    lastSession.sessionEnd = new Date();
    lastSession.sessionDuration = (lastSession.sessionEnd.getTime() - lastSession.sessionStart.getTime()) / 1000;

    // calcular tempo total de uso do usuário
    const totalUsageTime = userAnalysis.sessions.reduce((acc, session) => {
      return acc + (session.sessionDuration || 0);
    }, 0);

    await userAnalysis.save();

    return {
      message: "Sessão encerrada com sucesso.",
      sessionEnd: lastSession.sessionEnd,
      totalUsageTime,
    };
  }
}

export { LogoutUserService };
