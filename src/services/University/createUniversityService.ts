import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { AppError } from "../../exceptions/AppError";
import { Types } from "mongoose";

class createUniversityService {
  async create(name: string) {
    const existingUniversity = await University.findOne({ name });
    if (existingUniversity) {
      throw new AppError("Universidade já existe!", 409);
    }

    const university = await University.create({ name });
    return university;
  }

  // Listar todas as universidades
  async list() {
    const universities = await University.find().populate("courses", "name");
    return universities;
  }

  async deleteCourse(courseId: string) {
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

export { createUniversityService };
