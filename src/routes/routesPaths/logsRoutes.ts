import { Router } from "express";
import { LogUserController } from "../../controllers/Logs/LogUserController";
import { LogDisciplineController } from "../../controllers/Logs/LogDisciplineController";
import { LogCourseController } from "../../controllers/Logs/LogCourseController";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { LogClassController } from "../../controllers/Logs/LogClassController";

const logRoutes = Router();

const userController = new LogUserController();
const disciplineController = new LogDisciplineController();
const courseController = new LogCourseController();
const classController = new LogClassController();

/**
 * @swagger
 * tags:
 *   name: Logs
 *   description: Rotas relacionadas aos Logs de interação com o bot
 */

/**
 * @swagger
 * /logs/user/{userId}:
 *   get:
 *     tags: [Logs]
 *     summary: Buscar logs de um usuário
 *     description: Retorna os logs de interação de um usuário específico.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: ID do usuário
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Logs do usuário retornados com sucesso
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Logs não encontrados ou usuário inválido
 */
logRoutes.get("/user/:userId", isPermissions.isAdminProfessorOrCoordinator(), userController.getUserLogs.bind(userController));

/**
 * @swagger
 * /logs/class/{classId}:
 *   get:
 *     tags: [Logs]
 *     summary: Buscar logs de uma turma
 *     description: Retorna os logs de todos os alunos de uma turma específica.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         description: ID da turma
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Logs da turma retornados com sucesso
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Turma não encontrada
 */
logRoutes.get("/class/:classId", isPermissions.isAdminOrCoordinator(), classController.getClassLogs.bind(classController));

/**
 * @swagger
 * /logs/discipline/{disciplineId}:
 *   get:
 *     tags: [Logs]
 *     summary: Buscar logs de uma disciplina
 *     description: Retorna os logs de todos os alunos de uma disciplina específica.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: disciplineId
 *         required: true
 *         description: ID da disciplina
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Logs da disciplina retornados com sucesso
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Disciplina não encontrada
 */
logRoutes.get("/discipline/:disciplineId", isPermissions.isAdminProfessorOrCoordinator(), disciplineController.getDisciplineLogs.bind(disciplineController));

/**
 * @swagger
 * /logs/course/{courseId}:
 *   get:
 *     tags: [Logs]
 *     summary: Buscar logs de um curso
 *     description: Retorna os logs de todos os alunos de um curso específico.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         description: ID do curso
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Logs do curso retornados com sucesso
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Curso não encontrado
 */
logRoutes.get("/course/:courseId", isPermissions.isAdminOrCoordinator(), courseController.getCourseLogs.bind(courseController));

export { logRoutes };
