import { University } from "../../models/University";
import { Course } from "../../models/Course";

export async function getCoursesByUniversityIdService(universityId: string) {
  const university = await University.findById(universityId);
  if (!university) throw new Error("Universidade não encontrada");

  return await Course.find({ university: universityId }).lean();
}
