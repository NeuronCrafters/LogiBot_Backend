import { Course } from "../../../models/Course";
import { Types } from "@/types/UuidCompat";

class ListCoursesByUniversityService {
  async execute(universityId: string) {
    const universityUuid = new Types.Uuid(universityId);
    const courses = await Course.find({ university: universityUuid })
      .populate("professors", "name email")
      .populate("classes", "name")
      .populate("disciplines", "name code");

    return courses;
  }
}

export { ListCoursesByUniversityService };
