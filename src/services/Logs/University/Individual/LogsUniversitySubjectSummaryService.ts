import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";

export async function LogsUniversitySubjectSummaryService(universityId: string) {
  try {
    const users = await User.find({ school: universityId }, "_id");
    const userIds = users.map(u => u._id.toString());

    const logs = await UserAnalysis.find({ userId: { $in: userIds } });

    const summary: Record<string, number> = {};

    for (const log of logs) {
      const freq = log.subjectFrequencyGlobal || {};
      for (const key in freq) {
        summary[key] = (summary[key] || 0) + freq[key];
      }
    }

    return { summary };
  } catch (error) {
    throw new Error("Erro ao buscar resumo de assuntos da universidade");
  }
}
