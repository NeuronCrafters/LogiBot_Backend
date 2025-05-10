import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { CreateProfessorController } from "../../controllers/admin/admin/CreateProfessorController";
import { DeleteProfessorController } from "../../controllers/admin/admin/DeleteProfessorController";
import { ListAllProfessorsController } from "../../controllers/admin/admin/ListAllProfessorsController";
import { ListProfessorsByUniversityController } from "../../controllers/admin/admin/ListProfessorsByUniversityController";
import { ListProfessorsByCourseController } from "../../controllers/admin/admin/ListProfessorsByCourseController";
import { UpdateProfessorRoleController } from "../../controllers/admin/admin/UpdateProfessorRoleController";
import { ListStudentsController } from "../../controllers/admin/professor/ListStudentsController";
import { ListStudentsForProfessorController } from "../../controllers/admin/professor/ListStudentsForProfessorController";
import { ListProfessorsForCoordinatorController } from "../../controllers/admin/coordinator/ListProfessorsForCoordinatorController";
import { ListStudentsForCoordinatorController } from "../../controllers/admin/coordinator/ListStudentsForCoordinatorController";
import { ListStudentsByDisciplineForCoordinatorController } from "../../controllers/admin/coordinator/ListStudentsByDisciplineForCoordinatorController";
import { ListDisciplinesForCoordinatorController } from "../../controllers/admin/coordinator/ListDisciplinesForCoordinatorController";
import { ListClassesForCoordinatorController } from "../../controllers/admin/coordinator/ListClassesForCoordinatorController";

const adminRouter = Router();

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Rotas relacionadas ao administrador do sistema, aos Coordernadores de Curso e aos Professores
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
adminRouter.post(
  "/professor",
  ...isPermissions.isAdmin(),
  new CreateProfessorController().handle
);

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
adminRouter.delete(
  "/professor/:professorId",
  ...isPermissions.isAdmin(),
  new DeleteProfessorController().handle
);

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
 *       200:
 *         description: Lista de professores retornada com sucesso
 *       403:
 *         description: Acesso negado
 */
// ✅ Listar todos os professores do sistema (apenas admin)
adminRouter.get(
  "/professors",
  ...isPermissions.isAdmin(),
  new ListAllProfessorsController().handle
);

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
 *         schema:
 *           type: string
 *         description: ID da universidade
 *     responses:
 *       200:
 *         description: Professores retornados com sucesso
 *       404:
 *         description: Nenhum professor encontrado
 */
// ✅ Listar professores por universidade (apenas admin)
adminRouter.get(
  "/university/:schoolId/professors",
  ...isPermissions.isAdmin(),
  new ListProfessorsByUniversityController().handle
);

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
 *         schema:
 *           type: string
 *         description: ID do curso
 *     responses:
 *       200:
 *         description: Professores retornados com sucesso
 *       404:
 *         description: Curso não encontrado
 */
// ✅ Listar professores por curso (admin ou coordenador)
adminRouter.get(
  "/course/:courseId/professors",
  ...isPermissions.isAdminOrCoordinator(),
  new ListProfessorsByCourseController().handle
);

/**
 * @swagger
 * /admin/professor/{id}/role:
 *   patch:
 *     tags: [Admin]
 *     summary: Atualizar papel de um professor
 *     description: Adiciona ou remove o papel de "course-coordinator" a um professor. Somente administradores podem executar.
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
 *         description: Já existe um coordenador para este curso nesta universidade
 */
// ✅ Atualizar Professor e dar/remover o papel/role de coordenador de curso (apenas admin)
adminRouter.patch(
  "/professor/:id/role",
  ...isPermissions.isAdmin(),
  new UpdateProfessorRoleController().handle
);

/**
 * @swagger
 * /admin/students:
 *   get:
 *     tags: [Admin]
 *     summary: Listar alunos
 *     description: Lista alunos de acordo com o perfil do usuário (admin, course-coordinator ou professor).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de alunos retornada com sucesso
 *       401:
 *         description: Usuário não autenticado ou sem papel definido
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Professor ou coordenador não encontrado
 *       500:
 *         description: Erro interno ao processar a listagem de alunos
 */
// ✅ Listar alunos (admin, coordenadores e professores)
adminRouter.get(
  "/students",
  ...isPermissions.isAuthenticated(),
  new ListStudentsController().handle
);

/**
 * @swagger
 * /admin/professor/students:
 *   get:
 *     tags: [Admin]
 *     summary: Listar alunos para professor
 *     description: Retorna os alunos das disciplinas que o professor ministra.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alunos retornados com sucesso
 *       403:
 *         description: Acesso negado (não é professor)
 *       404:
 *         description: Nenhum aluno encontrado
 */
adminRouter.get(
  "/professor/students",
  ...isPermissions.isAuthenticated(),
  ListStudentsForProfessorController
);

/**
 * @swagger
 * /admin/coordinator/professors:
 *   get:
 *     tags: [Admin]
 *     summary: Listar professores para coordenador
 *     description: Retorna os professores que pertencem ao mesmo curso e universidade do coordenador.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Professores retornados com sucesso
 *       403:
 *         description: Acesso negado (não é course-coordinator)
 *       404:
 *         description: Coordenador ou curso não encontrado
 */
adminRouter.get(
  "/coordinator/professors",
  ...isPermissions.isAdminOrCoordinator(),
  ListProfessorsForCoordinatorController
);

/**
 * @swagger
 * /admin/coordinator/students:
 *   get:
 *     tags: [Admin]
 *     summary: Listar alunos para coordenador
 *     description: Retorna os alunos que pertencem ao mesmo curso e universidade do coordenador.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alunos retornados com sucesso
 *       403:
 *         description: Acesso negado (não é course-coordinator)
 *       404:
 *         description: Coordenador ou curso não encontrado
 */
adminRouter.get(
  "/coordinator/students",
  ...isPermissions.isAdminOrCoordinator(),
  ListStudentsForCoordinatorController
);

/**
 * @swagger
 * /admin/coordinator/students/discipline/{disciplineId}:
 *   get:
 *     tags: [Admin]
 *     summary: Listar alunos por disciplina para coordenador
 *     description: Retorna os alunos matriculados em uma disciplina específica, dentro do curso e universidade do coordenador.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: disciplineId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da disciplina
 *     responses:
 *       200:
 *         description: Alunos retornados com sucesso
 *       403:
 *         description: Acesso negado (não é course-coordinator)
 *       404:
 *         description: Coordenador, curso ou disciplina não encontrados
 */
adminRouter.get(
  "/coordinator/students/discipline/:disciplineId",
  ...isPermissions.isAdminOrCoordinator(),
  ListStudentsByDisciplineForCoordinatorController
);

// ...

/**
 * @swagger
 * /admin/coordinator/disciplines:
 *   get:
 *     tags: [Admin]
 *     summary: Listar disciplinas para coordenador
 *     description: Retorna as disciplinas do curso que o coordenador administra.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Disciplinas retornadas com sucesso
 *       403:
 *         description: Acesso negado (não é course-coordinator)
 *       404:
 *         description: Coordenador não encontrado
 */
adminRouter.get(
  "/coordinator/disciplines",
  ...isPermissions.isAdminOrCoordinator(),
  ListDisciplinesForCoordinatorController
);

/**
 * @swagger
 * /admin/coordinator/classes:
 *   get:
 *     tags: [Admin]
 *     summary: Listar turmas para coordenador
 *     description: Retorna as turmas do curso que o coordenador administra.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Turmas retornadas com sucesso
 *       403:
 *         description: Acesso negado (não é course-coordinator)
 *       404:
 *         description: Coordenador não encontrado
 */
adminRouter.get(
  "/coordinator/classes",
  ...isPermissions.isAdminOrCoordinator(),
  ListClassesForCoordinatorController
);

export { adminRouter };
