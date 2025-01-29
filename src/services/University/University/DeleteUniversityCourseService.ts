import { Course } from "../../../models/Course";
import { University } from "../../../models/University";
import { AppError } from "../../../exceptions/AppError";
import { Types } from "mongoose";

class DeleteUniversityCourseService {
  async execute(courseId: string) {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new AppError("ID do curso inválido!", 400);
    }

    const course = await Course.findByIdAndDelete(courseId);
    if (!course) {
      throw new AppError("Curso não encontrado!", 404);
    }

    await University.findByIdAndUpdate(course.university, {
      $pull: { courses: course._id },
    });

    return { message: "Curso removido com sucesso!" };
  }
}

export { DeleteUniversityCourseService };
