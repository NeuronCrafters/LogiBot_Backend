import { Router } from "express";
import { LogDisciplineController } from "../../controllers/Logs/LogDisciplineController";
import { LogCourseController } from "../../controllers/Logs/LogCourseController";
import { LogClassController } from "../../controllers/Logs/LogClassController";
import { LogStudentController } from "../../controllers/Logs/LogStudentController";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";

const logRoutes = Router();

const disciplineController = new LogDisciplineController();
const courseController = new LogCourseController();
const classController = new LogClassController();
const studentController = new LogStudentController();

/**
 * @swagger
 * tags:
 *   name: Logs
 *   description: Rotas relacionadas aos logs de interação com o bot.
 */

/**
 * @swagger
 * /logs/student/{id}:
 *   get:
 *     tags: [Logs]
 *     summary: Buscar logs de um aluno individual
 *     description: Retorna os logs de interação de um aluno específico. 
 *       O acesso é permitido para administradores, coordenadores do curso, professores que ministram em alguma disciplina na qual o aluno esteja matriculado ou o próprio aluno.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do aluno.
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         required: false
 *         description: Data de início para filtrar as sessões (formato ISO: YYYY-MM-DD).
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: false
 *         description: Data de término para filtrar as sessões (formato ISO: YYYY-MM-DD).
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Logs do aluno retornados com sucesso.
 *       403:
 *         description: Acesso negado.
 *       404:
 *         description: Logs não encontrados ou aluno inválido.
 */
logRoutes.get("/student/:id", isPermissions.isAuthenticated(), studentController.getStudentLogs.bind(studentController));

/**
 * @swagger
 * /logs/class/{classId}:
 *   get:
 *     tags: [Logs]
 *     summary: Buscar logs de uma turma
 *     description: Retorna os logs de todos os alunos de uma turma específica. 
 *       Os parâmetros de query startDate e endDate podem ser usados para filtrar as sessões 
 *       com base no campo sessionStart.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         description: ID da turma.
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         required: false
 *         description: Data de início para filtrar as sessões (formato ISO: YYYY-MM-DD).
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: false
 *         description: Data de término para filtrar as sessões (formato ISO: YYYY-MM-DD).
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Logs da turma retornados com sucesso.
 *       403:
 *         description: Acesso negado.
 *       404:
 *         description: Turma não encontrada ou logs não encontrados.
 */
logRoutes.get("/class/:classId", isPermissions.isAdminOrCoordinator(), classController.getClassLogs.bind(classController));

/**
 * @swagger
 * /logs/discipline/{disciplineId}:
 *   get:
 *     tags: [Logs]
 *     summary: Buscar logs de uma disciplina
 *     description: Retorna os logs de todos os alunos de uma disciplina específica.
 *       Utilize os parâmetros de query startDate e endDate para filtrar as sessões pelo campo sessionStart.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: disciplineId
 *         required: true
 *         description: ID da disciplina.
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         required: false
 *         description: Data de início para filtrar as sessões (formato ISO: YYYY-MM-DD).
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: false
 *         description: Data de término para filtrar as sessões (formato ISO: YYYY-MM-DD).
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Logs da disciplina retornados com sucesso.
 *       403:
 *         description: Acesso negado.
 *       404:
 *         description: Disciplina não encontrada ou logs não encontrados.
 */
logRoutes.get("/discipline/:disciplineId", isPermissions.isAdminProfessorOrCoordinator(), disciplineController.getDisciplineLogs.bind(disciplineController));

/**
 * @swagger
 * /logs/course/{courseId}:
 *   get:
 *     tags: [Logs]
 *     summary: Buscar logs de um curso
 *     description: Retorna os logs de todos os alunos de um curso específico.
 *       Os parâmetros de query startDate e endDate podem ser utilizados para filtrar as sessões com base no campo sessionStart.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         description: ID do curso.
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         required: false
 *         description: Data de início para filtrar as sessões (formato ISO: YYYY-MM-DD).
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: false
 *         description: Data de término para filtrar as sessões (formato ISO: YYYY-MM-DD).
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Logs do curso retornados com sucesso.
 *       403:
 *         description: Acesso negado.
 *       404:
 *         description: Curso não encontrado ou logs não encontrados.
 */
logRoutes.get("/course/:courseId", isPermissions.isAdminOrCoordinator(), courseController.getCourseLogs.bind(courseController));

export { logRoutes };
