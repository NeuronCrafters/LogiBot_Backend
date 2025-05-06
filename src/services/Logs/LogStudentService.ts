import { UserAnalysis } from "../../models/UserAnalysis";
import { User } from "../../models/User";
import { Discipline } from "../../models/Discipline";
import { AppError } from "../../exceptions/AppError";

class LogStudentService {
  async getStudentLogs(
    requestingUser: any,
    studentId: string,
    startDate?: string,
    endDate?: string
  ) {
    const isAdmin = requestingUser.role.includes("admin");
    const isSelf = requestingUser.id === studentId;
    const isCoordinator = requestingUser.role.includes("course-coordinator");

    if (!isAdmin && !isSelf && !isCoordinator) {
      if (!requestingUser.role.includes("professor")) {
        throw new AppError(
          "Acesso negado. Apenas professores, coordenadores ou administradores podem acessar os logs desse aluno.",
          403
        );
      }
      const student = await User.findById(studentId);
      if (!student) {
        throw new AppError("Aluno não encontrado.", 404);
      }
      const disciplines = await Discipline.find({
        _id: { $in: student.disciplines },
      });
      const isTeaching = disciplines.some((discipline) => {
        const profIds = discipline.professors.map((p: any) => p.toString());
        return profIds.includes(requestingUser.id);
      });
      if (!isTeaching) {
        throw new AppError(
          "Acesso negado. Você não ministra nenhuma disciplina desse aluno.",
          403
        );
      }
    }

    if (!startDate && !endDate) {
      const studentLog = await UserAnalysis.findOne({ userId: studentId });
      if (!studentLog) {
        throw new AppError("Logs do aluno não encontrados.", 404);
      }
      return studentLog;
    }

    let dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const pipeline = [
      { $match: { userId: studentId } },
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
    if (!results || results.length === 0) {
      throw new AppError("Logs do aluno não encontrados.", 404);
    }
    return results[0];
  }
}

export { LogStudentService };
