import { UserAnalysis } from "../../../models/UserAnalysis";

class AddInteractionService {
  async execute(userId: string, message: string, isOutOfScope: boolean = false) {
    const session = await UserAnalysis.findOne({ userId, endTime: null });

    if (!session) return null;

    session.interactions.push({ timestamp: new Date(), message });

    if (isOutOfScope) {
      session.outOfScopeQuestions = (session.outOfScopeQuestions || 0) + 1;
    }

    await session.save();
    return session;
  }
}

export const addInteractionService = new AddInteractionService();
