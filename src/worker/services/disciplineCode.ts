import { ObjectId } from "mongodb";
import { collections } from "../db/collections";
import type { ClassDocument, CourseDocument, DisciplineDocument, UniversityDocument } from "../types";

function generateHash(universityId: string, courseId: string, classId: string, disciplineId: string): string {
  const combined = `${universityId}${courseId}${classId}${disciplineId}`;
  let hash = 0;

  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const base36 = Math.abs(hash).toString(36).toUpperCase();
  return base36.padStart(8, "0").substring(0, 8);
}

export function generateDisciplineCode(
  universityId: string,
  courseId: string,
  classId: string,
  disciplineId: string,
): string {
  return generateHash(universityId, courseId, classId, disciplineId);
}

export interface DisciplineCodeEntities {
  university: UniversityDocument;
  course: CourseDocument;
  discipline: DisciplineDocument;
  classes: ClassDocument[];
}

export async function findEntitiesByCode(col: ReturnType<typeof collections>, code: string): Promise<DisciplineCodeEntities | null> {
  const discipline = await col.disciplines.findOne({ code });
  if (!discipline || !ObjectId.isValid(String(discipline.course))) {
    return null;
  }

  const course = await col.courses.findOne({ _id: new ObjectId(String(discipline.course)) });
  if (!course || !ObjectId.isValid(String(course.university))) {
    return null;
  }

  const university = await col.universities.findOne({ _id: new ObjectId(String(course.university)) });
  if (!university) {
    return null;
  }

  if (!university._id || !course._id || !discipline._id) return null;

  const classIds = (discipline.classes || []).filter((id) => ObjectId.isValid(String(id))).map((id) => new ObjectId(String(id)));
  const classes = classIds.length > 0 ? await col.classes.find({ _id: { $in: classIds } }).toArray() : [];

  return { university, course, discipline, classes };
}
