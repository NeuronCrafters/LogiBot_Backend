import { Course } from "../../models/Course";
import { User } from "../../models/User";
import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";

class LogCourseService {
  async getCourseLogs(requestingUser: any, courseId: string) {
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

    const logs = await UserAnalysis.find({ userId: { $in: userIds } });

    return {
      course: course.name,
      totalUsers: users.length,
      logs,
    };
  }
}

export { LogCourseService };