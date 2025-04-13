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
    if (!course) {
      throw new AppError("Curso não encontrado.", 404);
    }

    const isCoordinator = course.professors.some(
      (prof) => prof.toString() === requestingUser.id
    );

    if (
      !requestingUser.role.includes("admin") &&
      !isCoordinator &&
      !requestingUser.role.includes("course-coordinator")
    ) {
      throw new AppError("Acesso negado ao curso.", 403);
    }

    const users = await User.find({ course: courseId });
    const userIds = users.map((u) => u._id.toString());

    const query: any = { userId: { $in: userIds } };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await UserAnalysis.find(query);
    return {
      course: course.name,
      totalUsers: users.length,
      logs,
    };
  }
}

export { LogCourseService };
