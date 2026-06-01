import { Course } from "../../../models/Course";
import { University } from "../../../models/University";
import { AppError } from "../../../exceptions/AppError";
import { Types } from "@/types/UuidCompat";

class CreateCourseService {
  async execute(name: string, universityId: string) {
    const universityUuid = new Types.Uuid(universityId);

    const university = await University.findById(universityUuid);
    if (!university) {
      throw new AppError("universidade não encontrada!", 404);
    }

    const existingCourse = await Course.findOne({ name, university: universityUuid });
    if (existingCourse) {
      throw new AppError("curso já existe para esta universidade!", 409);
    }

    const course = await Course.create({ name, university: universityUuid });
    university.courses.push(course._id as Types.Uuid);
    await university.save();

    return course;
  }
}

export { CreateCourseService };
