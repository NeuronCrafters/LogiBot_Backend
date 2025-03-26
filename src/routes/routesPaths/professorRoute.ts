import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { ListStudentsController } from "../../controllers/professor/listStudentsController";

const professorRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Professor
 *   description: Rotas relacionadas aos professores
 */

/**
 * @swagger
 * /professor/{professorId}/students:
 *   get:
 *     tags: [Professor]
 *     summary: Listar alunos do professor
 *     description: Retorna todos os alunos associados a um professor específico.
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
 *         description: Lista de alunos retornada com sucesso
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Professor não encontrado
 */
// Listar alunos de um professor (somente Admin e Coordenadores)
professorRouter.get("/:professorId/students", ...isPermissions.isAdminOrCoordinator(), new ListStudentsController().handle);

export { professorRouter };
