import { Course } from "../../models/Course";
import { User } from "../../models/User";
import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";

class LogCourseService {
  async getCourseLogs(
    requestingUser: any,
    courseId: string,
    startDate?: string,
    endDate?: string
  ) {
    const course = await Course.findById(courseId);
    if (!course) throw new AppError("Curso não encontrado.", 404);

    const isCoordinator = course.professors.some((prof) => prof.toString() === requestingUser.id);

    if (
      !requestingUser.role.includes("admin") &&
      !isCoordinator &&
      !requestingUser.role.includes("course-coordinator")
    ) {
      throw new AppError("Acesso negado ao curso.", 403);
    }

    const users = await User.find({ course: courseId });
    const userIds = users.map((u) => u._id.toString());

    if (!startDate && !endDate) {
      const logs = await UserAnalysis.find({ userId: { $in: userIds } });
      return {
        course: course.name,
        totalUsers: users.length,
        logs,
      };
    }

    let dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const pipeline = [
      { $match: { userId: { $in: userIds } } },
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
      course: course.name,
      totalUsers: users.length,
      logs: aggregatedLogs,
    };
  }
}

export { LogCourseService };
