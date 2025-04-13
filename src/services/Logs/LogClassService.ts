import { UserAnalysis } from "../../models/UserAnalysis";
import { Class } from "../../models/Class";
import { AppError } from "../../exceptions/AppError";

class LogClassService {
  async getClassLogs(
    requestingUser: any,
    classId: string,
    startDate?: string,
    endDate?: string
  ) {
    const isAdmin = requestingUser.role.includes("admin");
    const isCoordinator = requestingUser.role.includes("course-coordinator");

    const turma = await Class.findById(classId).populate("students");
    if (!turma) throw new AppError("Turma não encontrada.", 404);

    if (!isAdmin) {
      if (
        !isCoordinator ||
        requestingUser.school?.toString() !== turma.course.toString()
      ) {
        throw new AppError(
          "Acesso negado. Apenas coordenadores do curso desta turma ou administradores podem acessar.",
          403
        );
      }
    }

    const studentIds = (turma.students as any[]).map((s) => s._id.toString());

    const query: any = { userId: { $in: studentIds } };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await UserAnalysis.find(query);
    return logs;
  }
}

export { LogClassService };
