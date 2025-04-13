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
    if (!discipline) throw new AppError("Disciplina não encontrada.", 404);

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

    if (!startDate && !endDate) {
      const logs = await UserAnalysis.find({ userId: { $in: discipline.students } });
      return {
        discipline: discipline.name,
        totalStudents: discipline.students.length,
        logs,
      };
    }

    let dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const pipeline = [
      { $match: { userId: { $in: discipline.students.map(s => s.toString()) } } },
      { $unwind: "$sessions" },
      { $match: { "sessions.sessionStart": dateFilter } },
      {
        $group: {
          _id: "$_id",
          userId: { $first: "$userId" },
          name: { $first: "$name" },
          email: { $first: "$email" },
          school: { $first: "$school" },
          courses: { $first: "$courses" },
          classes: { $first: "$classes" },
          totalUsageTime: { $first: "$totalUsageTime" },
          totalCorrectAnswers: { $first: "$totalCorrectAnswers" },
          totalWrongAnswers: { $first: "$totalWrongAnswers" },
          sessions: { $push: "$sessions" },
          __v: { $first: "$__v" }
        }
      }
    ];

    const aggregatedLogs = await UserAnalysis.aggregate(pipeline);
    return {
      discipline: discipline.name,
      totalStudents: discipline.students.length,
      logs: aggregatedLogs,
    };
  }
}

export { LogDisciplineService };
