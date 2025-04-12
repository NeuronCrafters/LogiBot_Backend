import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { CreateProfessorController } from "../../controllers/admin/createProfessorController";
import { ListProfessorsByCourseController } from "../../controllers/admin/ListProfessorsByCourseController";
import { DeleteProfessorController } from "../../controllers/admin/DeleteProfessorController";
import { ListProfessorsController } from "../../controllers/admin/ListProfessorsController";
import { ListStudentsProfessorController } from "../../controllers/admin/ListStudentsProfessorController";

const adminRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Rotas relacionadas ao administrador do sistema 
 */

/**
 * @swagger
 * /admin/professor:
 *   post:
 *     tags: [Admin]
 *     summary: Criação de novo professor
 *     description: Cria um novo professor e associa a cursos.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - school
 *               - courses
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               school:
 *                 type: string
 *               courses:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Professor criado com sucesso
 *       404:
 *         description: Curso não encontrado
 */
adminRouter.post("/professor", ...isPermissions.isAdmin(), new CreateProfessorController().handle);

/**
 * @swagger
 * /admin/professors:
 *   get:
 *     tags: [Admin]
 *     summary: Listar professores
 *     description: Lista todos os professores cadastrados.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de professores retornada com sucesso
 *       403:
 *         description: Acesso negado
 */
adminRouter.get("/professors", ...isPermissions.isAdminOrCoordinator(), new ListProfessorsController().handle);

/**
 * @swagger
 * /admin/professor/{professorId}/students:
 *   get:
 *     tags: [Admin]
 *     summary: Listar alunos de um professor
 *     description: Retorna os alunos associados a um professor específico.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: professorId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do professor
 *     responses:
 *       200:
 *         description: Alunos retornados com sucesso
 *       404:
 *         description: Professor não encontrado
 */
adminRouter.get("/professor/:professorId/students", ...isPermissions.isAdminOrCoordinator(), new ListStudentsProfessorController().handle);

/**
 * @swagger
 * /admin/course/{courseId}/professors:
 *   get:
 *     tags: [Admin]
 *     summary: Listar professores por curso
 *     description: Lista todos os professores associados a um curso.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: courseId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do curso
 *     responses:
 *       200:
 *         description: Lista de professores retornada com sucesso
 *       404:
 *         description: Curso não encontrado
 */
adminRouter.get("/course/:courseId/professors", ...isPermissions.isAdminOrCoordinator(), new ListProfessorsByCourseController().handle);

/**
 * @swagger
 * /admin/professor/{professorId}:
 *   delete:
 *     tags: [Admin]
 *     summary: Remover professor
 *     description: Deleta um professor do sistema.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: professorId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do professor
 *     responses:
 *       200:
 *         description: Professor removido com sucesso
 *       404:
 *         description: Professor não encontrado
 */
adminRouter.delete("/professor/:professorId", ...isPermissions.isAdmin(), new DeleteProfessorController().handle);

export { adminRouter };
