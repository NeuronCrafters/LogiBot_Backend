import { User, IUser } from "../../../models/User";

export async function ListStudentsByDisciplineForCoordinatorService(
  schoolId: string,
  courseId: string,
  disciplineId: string
): Promise<IUser[]> {
  return User.find({
    role: "student",
    school: schoolId,
    course: courseId,
    disciplines: disciplineId,
  }).exec();
}
