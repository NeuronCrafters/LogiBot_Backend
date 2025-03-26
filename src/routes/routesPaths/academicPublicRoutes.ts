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


/**
 * @swagger
 * tags:
 *   - name: Rotas Púlicas da Universidade
 *     description: Rotas relacionadas aos get de ajuda
 */

/**
 * @swagger
 * /public/institutions:
 *   get:
 *     tags: [Rotas Púlicas da Universidade]
 *     summary: Listar universidades com cursos e turmas
 *     responses:
 *       200:
 *         description: Lista de universidades com cursos e turmas
 */
/** Listar todas as universidades com cursos e turmas */
publicAcademicRoute.get("/institutions", getUniversitiesWithCoursesAndClassesController);


/**
 * @swagger
 * /public/courses/{universityId}:
 *   get:
 *     tags: [Rotas Púlicas da Universidade]
 *     summary: Listar cursos por universidade
 *     parameters:
 *       - in: path
 *         name: universityId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de cursos
 */
/** Listar cursos de uma universidade específica */
publicAcademicRoute.get("/courses/:universityId", getCoursesByUniversityIdController);


/**
 * @swagger
 * /public/disciplines/{universityId}/{courseId}:
 *   get:
 *     tags: [Rotas Púlicas da Universidade]
 *     summary: Listar disciplinas de um curso por universidade
 *     parameters:
 *       - in: path
 *         name: universityId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de disciplinas
 */
/** Listar disciplinas de um curso dentro de uma universidade */
publicAcademicRoute.get("/disciplines/:universityId/:courseId", getDisciplinesByCourseIdController);


/**
 * @swagger
 * /public/classes/{universityId}/{courseId}:
 *   get:
 *     tags: [Rotas Púlicas da Universidade]
 *     summary: Listar turmas de um curso por universidade
 *     parameters:
 *       - in: path
 *         name: universityId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de turmas
 */
/** Listar turmas de um curso dentro de uma universidade */
publicAcademicRoute.get("/classes/:universityId/:courseId", getClassesByCourseIdController);

/**
 * @swagger
 * /public/professors/{universityId}/{courseId}:
 *   get:
 *     tags: [Rotas Púlicas da Universidade]
 *     summary: Listar professores por universidade e curso
 *     parameters:
 *       - in: path
 *         name: universityId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: courseId
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de professores
 */
/** Listar professores vinculados a uma universidade e, opcionalmente, a um curso */
publicAcademicRoute.get("/professors/:universityId/:courseId?", getProfessorsByUniversityIdController);


/**
 * @swagger
 * /public/students/by-class/{universityId}/{courseId}/{classId}:
 *   get:
 *     tags: [Rotas Púlicas da Universidade]
 *     summary: Listar alunos por turma
 *     parameters:
 *       - in: path
 *         name: universityId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de alunos da turma
 */
/** Listar alunos de uma turma específica que pertence a um curso de uma universidade */
publicAcademicRoute.get("/students/by-class/:universityId/:courseId/:classId", getStudentsByClassIdController);


/**
 * @swagger
 * /public/students/by-discipline/{universityId}/{courseId}/{disciplineId}:
 *   get:
 *     tags: [Rotas Púlicas da Universidade]
 *     summary: Listar alunos por disciplina
 *     parameters:
 *       - in: path
 *         name: universityId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: disciplineId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de alunos da disciplina
 */
/** Listar alunos de uma disciplina específica */
publicAcademicRoute.get("/students/by-discipline/:universityId/:courseId/:disciplineId", getStudentsByDisciplineIdController);

/**
 * @swagger
 * /public/students/by-course/{universityId}/{courseId}:
 *   get:
 *     tags: [Rotas Púlicas da Universidade]
 *     summary: Listar alunos por curso
 *     parameters:
 *       - in: path
 *         name: universityId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de alunos do curso
 */
/** Listar todos os alunos de um curso */
publicAcademicRoute.get("/students/by-course/:universityId/:courseId", getStudentsByCourseIdController);

export { publicAcademicRoute };
