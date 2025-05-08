import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { CreateProfessorController } from "../../controllers/admin/createProfessorController";
import { ListProfessorsByCourseController } from "../../controllers/admin/ListProfessorsByCourseController";
import { DeleteProfessorController } from "../../controllers/admin/DeleteProfessorController";
import { ListStudentsProfessorController } from "../../controllers/admin/ListStudentsProfessorController";
import { UpdateProfessorRoleController } from "../../controllers/admin/UpdateProfessorRoleController";

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


/**
 * @swagger
 * /admin/professor/{id}/role:
 *   patch:
 *     tags: [Admin]
 *     summary: Atualizar papel de um professor
 *     description: Adiciona ou remove o papel de coordenador de curso a um professor. Somente administradores podem executar.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do professor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [add, remove]
 *                 description: Define se o papel de "course-coordinator" será adicionado ou removido.
 *     responses:
 *       200:
 *         description: Papel atualizado com sucesso
 *       400:
 *         description: Requisição inválida
 *       403:
 *         description: Acesso negado ou tentativa de autoalteração
 *       404:
 *         description: Professor não encontrado
 *       409:
 *         description: Já existe um coordenador no curso
 */
adminRouter.patch(
  "/professor/:id/role",
  ...isPermissions.isAdmin(),
  new UpdateProfessorRoleController().handle
);

export { adminRouter };
