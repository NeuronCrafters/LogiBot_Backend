import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";

export async function getClassesByCourseIdService(universityId: string, courseId: string) {
  const university = await University.findById(universityId);
  if (!university) throw new Error("Universidade não encontrada");

  const course = await Course.findOne({ _id: courseId, university: universityId });
  if (!course) throw new Error("Curso não encontrado para essa universidade");

  return await Class.find({ course: courseId }).lean();
}
