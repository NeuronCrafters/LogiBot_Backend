import { Class } from "../../../models/Class";
import { Types } from "@/types/UuidCompat";

class ListClassesByCourseService {
  async listClassByCouse(courseId: string) {
    const courseUuid = new Types.Uuid(courseId);
    const classes = await Class.find({ course: courseUuid })
      .populate("students", "name email")
      .populate("disciplines", "name");

    return classes;
  }
}

export { ListClassesByCourseService };
