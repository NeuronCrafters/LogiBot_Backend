import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";

export async function LogsUniversityUsageService(universityId: string) {
  try {
    const users = await User.find({ school: universityId }, "_id");
    const userIds = users.map(u => u._id.toString());

    const logs = await UserAnalysis.find({ userId: { $in: userIds } });

    const totalUsageTime = logs.reduce((acc, curr) => acc + (curr.totalUsageTime || 0), 0);

    return { totalUsageTime };
  } catch (error) {
    throw new Error("Erro ao buscar tempo de uso da universidade");
  }
}
