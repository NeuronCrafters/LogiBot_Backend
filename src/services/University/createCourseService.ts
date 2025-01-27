import { Course } from "../../models/Course";
import { University } from "../../models/University";
import { AppError } from "../../exceptions/AppError";
import { Types } from "mongoose";

class createCourseService {
  async create(name: string, universityId: string) {
    const universityObjectId = new Types.ObjectId(universityId);

    const university = await University.findById(universityObjectId);
    if (!university) {
      throw new AppError("Universidade não encontrada!", 404);
    }

    const existingCourse = await Course.findOne({ name, university: universityObjectId });
    if (existingCourse) {
      throw new AppError("Curso já existe para esta universidade!", 409);
    }

    const course = await Course.create({ name, university: universityObjectId });
    university.courses.push(course._id as Types.ObjectId);
    await university.save();

    return course;
  }

  async listByUniversity(universityId: string) {
    const universityObjectId = new Types.ObjectId(universityId);
    const courses = await Course.find({ university: universityObjectId });
    return courses;
  }
}

export { createCourseService };
