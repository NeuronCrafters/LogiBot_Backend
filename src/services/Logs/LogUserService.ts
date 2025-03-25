import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";

class LogUserService {
  async getUserLogs(requestingUser: any, targetUserId: string) {
    if (
      !requestingUser.role.includes("admin") &&
      requestingUser.id !== targetUserId
    ) {
      throw new AppError("Acesso negado.", 403);
    }

    const userLog = await UserAnalysis.findOne({ userId: targetUserId });
    if (!userLog) {
      throw new AppError("Logs do usuário não encontrados.", 404);
    }
    return userLog;
  }
}

export { LogUserService }