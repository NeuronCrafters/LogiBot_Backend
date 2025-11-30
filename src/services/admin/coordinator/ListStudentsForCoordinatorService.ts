import { User, IUser } from "../../../models/User";

export async function ListStudentsForCoordinatorService(
  schoolId: string,
  courseId: string
): Promise<IUser[]> {
  return User.find({
    role: "student",
    school: schoolId,
    course: courseId,
  }).exec();
}
