import { Class } from "../../../models/Class";
import { Course } from "../../../models/Course";
import { AppError } from "../../../exceptions/AppError";
import { Types } from "@/types/UuidCompat";

class CreateClassService {
  async execute(name: string, courseId: string) {
    const courseUuid = new Types.Uuid(courseId);

    const course = await Course.findById(courseUuid);
    if (!course) {
      throw new AppError("curso não encontrado!", 404);
    }

    const existingClass = await Class.findOne({ name, course: courseUuid });
    if (existingClass) {
      throw new AppError("turma já existe para este curso!", 409);
    }

    const classData = await Class.create({ name, course: courseUuid });
    course.classes.push(classData._id as Types.Uuid);
    await course.save();

    return classData;
  }
}

export { CreateClassService };
