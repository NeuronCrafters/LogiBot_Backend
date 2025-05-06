import { Class } from "../../../models/Class";
import { Types } from "mongoose";

class ListClassesByCourseService {
  async listClassByCouse(courseId: string) {
    const courseObjectId = new Types.ObjectId(courseId);
    const classes = await Class.find({ course: courseObjectId })
      .populate("students", "name email")
      .populate("disciplines", "name");

    return classes;
  }
}

export { ListClassesByCourseService };
