import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Discipline } from "../../models/Discipline";
import { User } from "../../models/User";

export async function getStudentsByDisciplineIdService(universityId: string, courseId: string, disciplineId: string) {
  const university = await University.findById(universityId);
  if (!university) throw new Error("Universidade não encontrada");

  const course = await Course.findOne({ _id: courseId, university: universityId });
  if (!course) throw new Error("Curso não encontrado para essa universidade");

  const discipline = await Discipline.findOne({ _id: disciplineId, course: courseId });
  if (!discipline) throw new Error("Disciplina não encontrada para esse curso");

  return await User.find(
    { disciplines: disciplineId, role: "student" },
    { name: 1, email: 1, status: 1, photo: 1 }
  ).lean();
}
