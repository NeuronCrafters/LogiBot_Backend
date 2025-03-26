import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";
import { User } from "../../models/User";

export async function getStudentsByClassIdService(universityId: string, courseId: string, classId: string) {
  const university = await University.findById(universityId);
  if (!university) {
    throw new Error("Universidade não encontrada");
  }

  const course = await Course.findOne({ _id: courseId, university: universityId });
  if (!course) {
    throw new Error("Curso não encontrado para essa universidade");
  }

  const classDoc = await Class.findOne({ _id: classId, course: courseId });
  if (!classDoc) {
    throw new Error("Turma não encontrada para esse curso");
  }

  const students = await User.find(
    { class: classId, role: "student" },
    { name: 1, email: 1, status: 1, photo: 1 }
  ).lean();

  return students;
}