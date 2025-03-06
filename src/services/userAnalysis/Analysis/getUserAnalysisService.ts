import { UserAnalysis } from "../../../models/UserAnalysis";

class GetUserAnalysisService {
  async execute(userId: string) {
    return await UserAnalysis.findOne({ userId, endTime: null });
  }
}

export const getUserAnalysisService = new GetUserAnalysisService();
