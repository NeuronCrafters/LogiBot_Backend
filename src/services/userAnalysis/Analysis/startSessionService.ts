import { UserAnalysis } from "../../../models/UserAnalysis";

class StartSessionService {
  async execute(userId: string, dispositivo: string) {
    let session = await UserAnalysis.findOne({ userId, endTime: null });

    if (!session) {
      session = await UserAnalysis.create({ userId, dispositivo });
    } else {
      session.dispositivo = dispositivo;
    }

    await session.save();
    return session;
  }
}

export const startSessionService = new StartSessionService();
