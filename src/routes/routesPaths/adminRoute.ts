import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { CreateProfessorController } from "../../controllers/admin/professor/createProfessorController";
import { ListProfessorsByCourseController } from "../../controllers/admin/professor/ListProfessorsByCourseController";
import { DeleteProfessorController } from "../../controllers/admin/professor/DeleteProfessorController";
import { UpdateProfessorRoleController } from "../../controllers/admin/professor/UpdateProfessorRoleController";
import { ListProfessorsByUniversityController } from "../../controllers/admin/professor/ListProfessorsByUniversityController";
import { ListAllProfessorsController } from "../../controllers/admin/professor/ListAllProfessorsController";

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
// ✅ Criar um Professor (apenas admin)
adminRouter.post("/professor", ...isPermissions.isAdmin(), new CreateProfessorController().handle);

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
// ✅ Deletar um Professor (apenas admin)
adminRouter.delete("/professor/:professorId", ...isPermissions.isAdmin(), new DeleteProfessorController().handle);

/**
 * @swagger
 * /admin/professors:
 *   get:
 *     tags: [Admin]
 *     summary: Listar todos os professores
 *     description: Lista todos os professores do sistema (acesso exclusivo de admins).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista retornada com sucesso }
 *       403: { description: Acesso negado }
 */
// ✅ Listar todos os professores do sistema (apenas admin)
adminRouter.get("/professors", ...isPermissions.isAdmin(), new ListAllProfessorsController().handle);


/**
 * @swagger
 * /admin/university/{schoolId}/professors:
 *   get:
 *     tags: [Admin]
 *     summary: Listar professores por universidade
 *     description: Retorna os professores de uma universidade específica.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schoolId
 *         required: true
 *         schema: { type: string }
 *         description: ID da universidade
 *     responses:
 *       200: { description: Professores retornados }
 *       404: { description: Nenhum professor encontrado }
 */
// ✅ Listar professores por universidade (apenas admin)
adminRouter.get("/university/:schoolId/professors", ...isPermissions.isAdmin(), new ListProfessorsByUniversityController().handle);

/**
 * @swagger
 * /admin/course/{courseId}/professors:
 *   get:
 *     tags: [Admin]
 *     summary: Listar professores por curso
 *     description: Retorna os professores de um curso específico.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *         description: ID do curso
 *     responses:
 *       200: { description: Professores retornados }
 *       404: { description: Curso não encontrado }
 */
// ✅ Listar professores por curso (admin ou coordenador)
adminRouter.get("/course/:courseId/professors", ...isPermissions.isAdminOrCoordinator(), new ListProfessorsByCourseController().handle);


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
// ✅ Atualizar Professor e dar/remover o papel/role de coordernador de curso
adminRouter.patch("/professor/:id/role", ...isPermissions.isAdmin(), new UpdateProfessorRoleController().handle
);



export { adminRouter };
