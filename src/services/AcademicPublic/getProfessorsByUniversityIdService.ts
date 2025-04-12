import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Professor } from "../../models/Professor";

export async function getProfessorsByUniversityIdService(universityId: string, courseId?: string) {
  const university = await University.findById(universityId);
  if (!university) {
    throw new Error("Universidade não encontrada");
  }

  let query = { university: universityId } as any;
  if (courseId) {
    const course = await Course.findOne({ _id: courseId, university: universityId });
    if (!course) {
      throw new Error("Curso não encontrado para essa universidade");
    }
    query.course = courseId;
  }

  const professors = await Professor.find(query).lean();
  return professors;
}
