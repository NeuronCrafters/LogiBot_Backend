import { UserAnalysis } from "@/models/UserAnalysis";
import { User } from "@/models/User";

export async function LogsUniversityAccuracyService(universityId: string) {
  try {
    const users = await User.find({ school: universityId }, "_id");
    const userIds = users.map(u => u._id.toString());

    const logs = await UserAnalysis.find({ userId: { $in: userIds } });

    const totalCorrect = logs.reduce((acc, curr) => acc + (curr.totalCorrectAnswers || 0), 0);
    const totalWrong = logs.reduce((acc, curr) => acc + (curr.totalWrongAnswers || 0), 0);

    return { totalCorrect, totalWrong };
  } catch (error) {
    throw new Error("Erro ao buscar acertos e erros da universidade");
  }
}
