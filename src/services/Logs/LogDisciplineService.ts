import { Discipline } from "../../models/Discipline";
import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";

class LogDisciplineService {
  async getDisciplineLogs(
    requestingUser: any,
    disciplineId: string,
    startDate?: string,
    endDate?: string
  ) {
    const discipline = await Discipline.findById(disciplineId);
    if (!discipline) {
      throw new AppError("Disciplina não encontrada.", 404);
    }

    const isProfessor = discipline.professors.some(
      (prof) => prof.toString() === requestingUser.id
    );

    if (
      !requestingUser.role.includes("admin") &&
      !requestingUser.role.includes("course-coordinator") &&
      !isProfessor
    ) {
      throw new AppError("Acesso negado à disciplina.", 403);
    }

    const query: any = { userId: { $in: discipline.students } };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await UserAnalysis.find(query);
    return {
      discipline: discipline.name,
      totalStudents: discipline.students.length,
      logs,
    };
  }
}

export { LogDisciplineService };
