import { UserAnalysis } from "../../models/UserAnalysis";

class LogoutUSerService {
  async logout(userId: string) {
    if (!userId) {
      throw new Error("O 'userId' é obrigatório para realizar o logout.");
    }

    const userSession = await UserAnalysis.findOne({ userId }).sort({ sessionStart: -1 });

    if (!userSession) {
      throw new Error("Nenhuma sessão ativa encontrada para este usuário.");
    }

    userSession.sessionEnd = new Date();
    userSession.sessionDuration = (userSession.sessionEnd.getTime() - userSession.sessionStart.getTime()) / 1000;

    await userSession.save();
  }
}

export { LogoutUSerService };
