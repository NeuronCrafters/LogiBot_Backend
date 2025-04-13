import { Discipline } from "../../models/Discipline";
import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";

class LogDisciplineService {
  async getDisciplineLogs(requestingUser: any, disciplineId: string) {
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

    const logs = await UserAnalysis.find({ userId: { $in: discipline.students } });

    return {
      discipline: discipline.name,
      totalStudents: discipline.students.length,
      logs,
    };
  }
}

export { LogDisciplineService }
