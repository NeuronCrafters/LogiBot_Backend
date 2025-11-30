import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { CreateClassController } from "../../controllers/University/Class/CreateClassController";
import { DeleteClassController } from "../../controllers/University/Class/DeleteClassController";
import { ListClassesByCourseController } from "../../controllers/University/Class/ListClassesByCourseController";
import { CreateCourseController } from "../../controllers/University/Course/CreateCourseController";
import { DeleteCourseController } from "../../controllers/University/Course/DeleteCourseController";
import { ListCoursesByUniversityController } from "../../controllers/University/Course/ListCoursesByUniversityController";
import { CreateDisciplineController } from "../../controllers/University/Discipline/CreateDisciplineController";
import { DeleteDisciplineController } from "../../controllers/University/Discipline/DeleteDisciplineController";
import { ListDisciplinesController } from "../../controllers/University/Discipline/ListDisciplinesController";
import { CreateUniversityController } from "../../controllers/University/University/CreateUniversityController";
import { DeleteUniversityController } from "../../controllers/University/University/DeleteUniversityController";
import { ListUniversitiesController } from "../../controllers/University/University/ListUniversitiesController";

const academicInstitutionRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Universidade
 *   description: Rotas relacionadas à gestão acadêmica (universidades, cursos, turmas, disciplinas)
 */

/**
 * @swagger
 * /academic-institution/university:
 *   post:
 *     summary: Criação de uma nova universidade
 *     tags: [Universidade]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Universidade criada com sucesso
 *       409:
 *         description: Universidade já existente
 */
academicInstitutionRouter.post("/university", ...isPermissions.isAdmin(), new CreateUniversityController().handle);

/**
 * @swagger
 * /academic-institution/university:
 *   get:
 *     summary: Listar todas as universidades
 *     tags: [Universidade]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de universidades retornada com sucesso
 */
academicInstitutionRouter.get("/university", ...isPermissions.isAdmin(), new ListUniversitiesController().handle);

/**
 * @swagger
 * /academic-institution/university/{universityId}:
 *   delete:
 *     summary: Deletar uma universidade
 *     tags: [Universidade]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: universityId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Universidade deletada com sucesso
 *       404:
 *         description: Universidade não encontrada
 */
academicInstitutionRouter.delete("/university/:universityId", ...isPermissions.isAdmin(), new DeleteUniversityController().handle);

/**
 * @swagger
 * /academic-institution/course:
 *   post:
 *     summary: Criação de um novo curso
 *     tags: [Universidade]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               universityId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Curso criado com sucesso
 *       409:
 *         description: Curso já existente
 */
academicInstitutionRouter.post("/course", ...isPermissions.isAdmin(), new CreateCourseController().handle);

/**
 * @swagger
 * /academic-institution/course/{universityId}:
 *   get:
 *     summary: Listar cursos por universidade
 *     tags: [Universidade]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: universityId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de cursos retornada com sucesso
 */
academicInstitutionRouter.get("/course/:universityId", ...isPermissions.isAdmin(), new ListCoursesByUniversityController().handle);

/**
 * @swagger
 * /academic-institution/course/{courseId}:
 *   delete:
 *     summary: Deletar um curso
 *     tags: [Universidade]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Curso deletado com sucesso
 *       404:
 *         description: Curso não encontrado
 */
academicInstitutionRouter.delete("/course/:courseId", ...isPermissions.isAdmin(), new DeleteCourseController().handle);

/**
 * @swagger
 * /academic-institution/class:
 *   post:
 *     tags: [Universidade]
 *     summary: Criar nova turma
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               courseId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Turma criada com sucesso
 */
academicInstitutionRouter.post("/class", ...isPermissions.isAdminOrCoordinator(), new CreateClassController().handle);

/**
 * @swagger
 * /academic-institution/class/{courseId}:
 *   get:
 *     tags: [Universidade]
 *     summary: Listar turmas de um curso
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de turmas
 */
academicInstitutionRouter.get("/class/:courseId", ...isPermissions.isAdminOrCoordinator(), new ListClassesByCourseController().handle);

/**
 * @swagger
 * /academic-institution/class/{classId}:
 *   delete:
 *     tags: [Universidade]
 *     summary: Deletar turma
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Turma deletada com sucesso
 */
academicInstitutionRouter.delete("/class/:classId", ...isPermissions.isAdminOrCoordinator(), new DeleteClassController().handle);


/**
 * @swagger
 * /academic-institution/discipline:
 *   post:
 *     tags: [Universidade]
 *     summary: Criar nova disciplina
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               courseId:
 *                 type: string
 *               classIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               professorIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Disciplina criada com sucesso
 */
academicInstitutionRouter.post("/discipline", ...isPermissions.isAdminOrCoordinator(), new CreateDisciplineController().handle);

/**
 * @swagger
 * /academic-institution/discipline:
 *   get:
 *     tags: [Universidade]
 *     summary: Listar disciplinas
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de disciplinas
 */
academicInstitutionRouter.get("/discipline", ...isPermissions.isAdminOrCoordinator(), new ListDisciplinesController().handle);

/**
 * @swagger
 * /academic-institution/discipline/{disciplineId}:
 *   delete:
 *     tags: [Universidade]
 *     summary: Deletar disciplina
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: disciplineId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Disciplina deletada com sucesso
 */
academicInstitutionRouter.delete("/discipline/:disciplineId", ...isPermissions.isAdminOrCoordinator(), new DeleteDisciplineController().handle);

export { academicInstitutionRouter };
