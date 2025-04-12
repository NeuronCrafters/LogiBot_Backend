import { UserAnalysis } from "../../models/UserAnalysis";
import { Class } from "../../models/Class";
import { AppError } from "../../exceptions/AppError";

class LogClassService {
  async getClassLogs(requestingUser: any, classId: string) {
    const isAdmin = requestingUser.role.includes("admin");
    const isCoordinator = requestingUser.role.includes("course-coordinator");

    const turma = await Class.findById(classId).populate("students");
    if (!turma) throw new AppError("Turma não encontrada.", 404);

    if (!isAdmin) {
      if (!isCoordinator || requestingUser.school?.toString() !== turma.course.toString()) {
        throw new AppError("Acesso negado. Apenas coordenadores do curso desta turma ou administradores podem acessar.", 403);
      }
    }

    const studentIds = (turma.students as any[]).map(s => s._id.toString());
    const logs = await UserAnalysis.find({ userId: { $in: studentIds } });

    return logs;
  }
}

export { LogClassService };
