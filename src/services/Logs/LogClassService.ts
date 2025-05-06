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
      if (!isCoordinator || requestingUser.school?.toString() !== turma.course.toString()) {
        throw new AppError("Acesso negado. Apenas coordenadores do curso desta turma ou administradores podem acessar.", 403);
      }
    }

    const studentIds = (turma.students as any[]).map(s => s._id.toString());

    if (!startDate && !endDate) {
      const logs = await UserAnalysis.find({ userId: { $in: studentIds } });
      return logs;
    }

    let dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const pipeline = [
      { $match: { userId: { $in: studentIds } } },
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
          mostAccessedSubject: { $first: "$mostAccessedSubject" },
          leastAccessedSubject: { $first: "$leastAccessedSubject" },
          subjectMostCorrect: { $first: "$subjectMostCorrect" },
          subjectMostWrong: { $first: "$subjectMostWrong" },
          sessions: { $push: "$sessions" },
          __v: { $first: "$__v" }
        }
      }
    ];

    const results = await UserAnalysis.aggregate(pipeline);
    return results;
  }
}

export { LogClassService };
