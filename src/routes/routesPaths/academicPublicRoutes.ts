import { Router } from "express";
import { getUniversitiesWithCoursesAndClassesController } from "../../controllers/AcademicPublic/getUniversitiesWithCoursesAndClassesController";
import { getCoursesByUniversityIdController } from "../../controllers/AcademicPublic/getCoursesByUniversityIdController";
import { getDisciplinesByCourseIdController } from "../../controllers/AcademicPublic/getDisciplinesByCourseIdController";
import { getClassesByCourseIdController } from "../../controllers/AcademicPublic/getClassesByCourseIdController";
import { getProfessorsByUniversityIdController } from "../../controllers/AcademicPublic/getProfessorsByUniversityIdController";
import { getStudentsByClassIdController } from "../../controllers/AcademicPublic/getStudentsByClassIdController";
import { getStudentsByDisciplineIdController } from "../../controllers/AcademicPublic/getStudentsByDisciplineIdController";
import { getStudentsByCourseIdController } from "../../controllers/AcademicPublic/getStudentsByCourseIdController";

const publicAcademicRoute = Router();

/** Listar todas as universidades com cursos e turmas */
publicAcademicRoute.get("/institutions", getUniversitiesWithCoursesAndClassesController);

/** Listar cursos de uma universidade específica */
publicAcademicRoute.get("/courses/:universityId", getCoursesByUniversityIdController);

/** Listar disciplinas de um curso dentro de uma universidade */
publicAcademicRoute.get("/disciplines/:universityId/:courseId", getDisciplinesByCourseIdController);

/** Listar turmas de um curso dentro de uma universidade */
publicAcademicRoute.get("/classes/:universityId/:courseId", getClassesByCourseIdController);

/** Listar professores vinculados a uma universidade e, opcionalmente, a um curso */
publicAcademicRoute.get("/professors/:universityId/:courseId?", getProfessorsByUniversityIdController);

/** Listar alunos de uma turma específica que pertence a um curso de uma universidade */
publicAcademicRoute.get("/students/by-class/:universityId/:courseId/:classId", getStudentsByClassIdController);

/** Listar alunos de uma disciplina específica */
publicAcademicRoute.get("/students/by-discipline/:universityId/:courseId/:disciplineId", getStudentsByDisciplineIdController);

/** Listar todos os alunos de um curso */
publicAcademicRoute.get("/students/by-course/:universityId/:courseId", getStudentsByCourseIdController);

export { publicAcademicRoute };
