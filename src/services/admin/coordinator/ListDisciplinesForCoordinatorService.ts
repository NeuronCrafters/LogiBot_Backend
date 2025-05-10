import { Discipline, IDiscipline } from "../../../models/Discipline";

export async function ListDisciplinesForCoordinatorService(
  schoolId: string,
  courseId: string
): Promise<IDiscipline[]> {

  return Discipline.find({ course: courseId }).exec();
}
