import { Class, IClass } from "../../../models/Class";
import { Course } from "../../../models/Course";

export async function ListClassesForCoordinatorService(
  schoolId: string,
  courseId: string
): Promise<IClass[]> {

  const course = await Course.findOne({
    _id: courseId,
    university: schoolId,
  }).lean();
  if (!course) {
    throw new Error("Curso não pertence à sua universidade.");
  }

  return Class.find({ course: courseId }).lean().exec();
}
