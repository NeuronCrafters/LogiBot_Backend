import { UserAnalysis } from "../../../models/UserAnalysis";

class SetTaxaDeAcertosService {
  async execute(userId: string, taxa: number) {
    const session = await UserAnalysis.findOne({ userId, endTime: null });

    if (session) {
      session.taxaDeAcertos = taxa;
      await session.save();
    }

    return session;
  }
}

export const setTaxaDeAcertosService = new SetTaxaDeAcertosService();
