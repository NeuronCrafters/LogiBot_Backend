import { Professor, IProfessor } from "../../../models/Professor";

export async function ListProfessorsForCoordinatorService(
  schoolId: string,
  courseId: string
): Promise<IProfessor[]> {
  return Professor.find({
    school: schoolId,
    courses: courseId,
  }).exec();
}
