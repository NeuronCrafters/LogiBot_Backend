import { UserAnalysis } from "../../../models/UserAnalysis";

class AddInteracaoForaDaSalaService {
  async execute(userId: string) {
    const session = await UserAnalysis.findOne({ userId, endTime: null });

    if (session) {
      if (!session.interacoesForaDaSala) {
        session.interacoesForaDaSala = [];
      }
      session.interacoesForaDaSala.push({ timestamp: new Date() });
      await session.save();
    }

    return session;
  }
}

export const addInteracaoForaDaSalaService = new AddInteracaoForaDaSalaService();
