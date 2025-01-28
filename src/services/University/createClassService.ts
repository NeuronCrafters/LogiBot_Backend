import { Class } from "../../models/Class";
import { Course } from "../../models/Course";
import { AppError } from "../../exceptions/AppError";
import { Types } from "mongoose";

class createClassService {
  async create(name: string, courseId: string) {
    const courseObjectId = new Types.ObjectId(courseId);

    const course = await Course.findById(courseObjectId);
    if (!course) {
      throw new AppError("Curso não encontrado!", 404);
    }

    const existingClass = await Class.findOne({ name, course: courseObjectId });
    if (existingClass) {
      throw new AppError("Turma já existe para este curso!", 409);
    }

    const classData = await Class.create({ name, course: courseObjectId });
    course.classes.push(classData._id as Types.ObjectId);
    await course.save();

    return classData;
  }

  async listByCourse(courseId: string) {
    const courseObjectId = new Types.ObjectId(courseId);
    const classes = await Class.find({ course: courseObjectId }).populate("students", "name email");
    return classes;
  }

  async delete(classId: string) {
    if (!Types.ObjectId.isValid(classId)) {
      throw new AppError("ID da turma inválido!", 400);
    }

    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      throw new AppError("Turma não encontrada!", 404);
    }

    await Class.findOneAndDelete({ _id: classId });
    return { message: "Turma removida com sucesso!" };
  }
}

export { createClassService };
