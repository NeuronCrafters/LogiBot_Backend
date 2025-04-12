import { UserAnalysis } from "../../models/UserAnalysis";
import { Professor } from "../../models/Professor";
import { User } from "../../models/User";
import { AppError } from "../../exceptions/AppError";

class LogUserService {
  async getUserLogs(requestingUser: any, targetUserId: string) {
    const isAdmin = requestingUser.role.includes("admin");
    const isSelf = requestingUser.id === targetUserId;

    if (!isAdmin && !isSelf) {
      const professor = await Professor.findById(requestingUser.id).populate("students");
      if (!professor) {
        throw new AppError("Professor não encontrado.", 404);
      }

      const studentIsAssociated = professor.students.some(
        (student: any) => student._id.toString() === targetUserId
      );

      if (!studentIsAssociated) {
        throw new AppError("O aluno não está associado a este professor.", 403);
      }
    }

    const user = await User.findById(targetUserId);
    if (!user || !user.role.includes("student")) {
      throw new AppError("Aluno não encontrado ou não é válido.", 404);
    }

    const userLog = await UserAnalysis.findOne({ userId: targetUserId });
    if (!userLog) {
      throw new AppError("Logs do usuário não encontrados.", 404);
    }

    return userLog;
  }
}

export { LogUserService };