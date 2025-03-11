import { Router } from "express";
import {
  getUniversitiesWithCoursesAndClasses,
  getCoursesByUniversityId,
  getDisciplinesByCourseId,
  getClassesByCourseId,
  getProfessorsByUniversityId,
  getStudentsByClassId,
  getStudentsByDisciplineId,
  getStudentsByCourseId
} from "../../controllers/AcademicPublic/academicPublicController";

const publicAcademicRoute = Router();

/** Listar todas as universidades com cursos e turmas */
publicAcademicRoute.get("/institutions", getUniversitiesWithCoursesAndClasses);

/** Listar cursos de uma universidade específica */
publicAcademicRoute.get("/courses/:universityId", getCoursesByUniversityId);

/** Listar disciplinas de um curso dentro de uma universidade */
publicAcademicRoute.get("/disciplines/:universityId/:courseId", getDisciplinesByCourseId);

/** Listar turmas de um curso dentro de uma universidade */
publicAcademicRoute.get("/classes/:universityId/:courseId", getClassesByCourseId);

/** Listar professores vinculados a uma universidade e, opcionalmente, a um curso */
publicAcademicRoute.get("/professors/:universityId/:courseId?", getProfessorsByUniversityId);

/** Listar alunos de uma turma específica que pertence a um curso de uma universidade */
publicAcademicRoute.get("/students/:universityId/:courseId/:classId", getStudentsByClassId);

/** Listar alunos de uma disciplina específica */
publicAcademicRoute.get("/students/:universityId/:courseId/:disciplineId", getStudentsByDisciplineId);

/** Listar todos os alunos de um curso */
publicAcademicRoute.get("/students/:universityId/:courseId", getStudentsByCourseId);

export { publicAcademicRoute };