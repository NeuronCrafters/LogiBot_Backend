import { UserAnalysis } from "../../../models/UserAnalysis";

class EndSessionService {
  async execute(userId: string) {
    const session = await UserAnalysis.findOne({ userId, endTime: null });

    if (session) {
      session.endTime = new Date();
      session.totalTime = (session.endTime.getTime() - session.startTime.getTime()) / 1000;
      await session.save();
    }

    return session;
  }
}

export const endSessionService = new EndSessionService();
