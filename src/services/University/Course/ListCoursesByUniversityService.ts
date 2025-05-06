import { Course } from "../../../models/Course";
import { Types } from "mongoose";

class ListCoursesByUniversityService {
  async execute(universityId: string) {
    const universityObjectId = new Types.ObjectId(universityId);
    const courses = await Course.find({ university: universityObjectId })
      .populate("professors", "name email")
      .populate("classes", "name")
      .populate("disciplines", "name code");

    return courses;
  }
}

export { ListCoursesByUniversityService };
