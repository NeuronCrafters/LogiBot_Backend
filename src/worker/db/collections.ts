import type { Db } from "mongodb";
import type {
  ClassDocument,
  CourseDocument,
  DisciplineDocument,
  ProfessorDocument,
  StudentDocument,
  UniversityDocument,
  UserAnalysisDocument,
} from "../types";

export function collections(db: Db) {
  return {
    users: db.collection<StudentDocument>("users"),
    professors: db.collection<ProfessorDocument>("professors"),
    universities: db.collection<UniversityDocument>("universities"),
    courses: db.collection<CourseDocument>("courses"),
    classes: db.collection<ClassDocument>("classes"),
    disciplines: db.collection<DisciplineDocument>("disciplines"),
    userAnalyses: db.collection<UserAnalysisDocument>("useranalyses"),
  };
}
