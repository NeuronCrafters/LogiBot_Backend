import { Class } from "../../../models/Class";
import { Course } from "../../../models/Course";
import { AppError } from "../../../exceptions/AppError";
import { Types } from "mongoose";

class CreateClassService {
  async execute(name: string, courseId: string) {
    const courseObjectId = new Types.ObjectId(courseId);

    const course = await Course.findById(courseObjectId);
    if (!course) {
      throw new AppError("curso não encontrado!", 404);
    }

    const existingClass = await Class.findOne({ name, course: courseObjectId });
    if (existingClass) {
      throw new AppError("turma já existe para este curso!", 409);
    }

    const classData = await Class.create({ name, course: courseObjectId });
    course.classes.push(classData._id as Types.ObjectId);
    await course.save();

    return classData;
  }
}

export { CreateClassService };
