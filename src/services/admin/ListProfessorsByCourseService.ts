import { Course } from "../../models/Course";
import { AppError } from "../../exceptions/AppError";

class ListProfessorsByCourseService {
  async execute(courseId: string) {
    const course = await Course.findById(courseId).populate("professors", "name email");
    if (!course) {
      throw new AppError("Curso não encontrado.", 404);
    }

    return course.professors;
  }
}

export { ListProfessorsByCourseService };
