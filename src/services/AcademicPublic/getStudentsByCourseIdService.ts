import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { User } from "../../models/User";

export async function getStudentsByCourseIdService(universityId: string, courseId: string) {
  const university = await University.findById(universityId);
  if (!university) throw new Error("Universidade não encontrada");

  const course = await Course.findOne({ _id: courseId, university: universityId });
  if (!course) throw new Error("Curso não encontrado para essa universidade");

  return await User.find(
    { course: courseId, role: "student" },
    { name: 1, email: 1, status: 1, photo: 1 }
  ).lean();
}
