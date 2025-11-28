import { Discipline, IDiscipline } from "../../../models/Discipline";
import { Course } from "../../../models/Course";

export async function ListDisciplinesForCoordinatorService(
  schoolId: string,
  courseId: string
): Promise<IDiscipline[]> {

  const course = await Course.findOne({
    _id: courseId,
    university: schoolId,
  }).lean();
  if (!course) {
    throw new Error("curso não pertence à sua universidade.");
  }

  return Discipline.find({ course: courseId }).lean().exec();
}
