import { Course } from "../../../models/Course";
import { AppError } from "../../../exceptions/AppError";
import { Types } from "mongoose";

class DeleteCourseService {
  async execute(courseId: string) {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new AppError("id do curso inválido!", 400);
    }

    const course = await Course.findById(courseId);
    if (!course) {
      throw new AppError("curso não encontrado!", 404);
    }

    await Course.findOneAndDelete({ _id: courseId });

    return { message: "Curso removido com sucesso!" };
  }
}

export { DeleteCourseService };
