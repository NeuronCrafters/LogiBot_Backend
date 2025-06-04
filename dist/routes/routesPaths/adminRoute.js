"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const isPermissions_1 = require("../../middlewares/isPermissions/isPermissions");
const CreateProfessorController_1 = require("../../controllers/admin/admin/CreateProfessorController");
const DeleteProfessorController_1 = require("../../controllers/admin/admin/DeleteProfessorController");
const ListAllProfessorsController_1 = require("../../controllers/admin/admin/ListAllProfessorsController");
const ListProfessorsByUniversityController_1 = require("../../controllers/admin/admin/ListProfessorsByUniversityController");
const ListProfessorsByCourseController_1 = require("../../controllers/admin/admin/ListProfessorsByCourseController");
const UpdateProfessorRoleController_1 = require("../../controllers/admin/admin/UpdateProfessorRoleController");
const ListStudentsController_1 = require("../../controllers/admin/professor/ListStudentsController");
const ListStudentsForProfessorController_1 = require("../../controllers/admin/professor/ListStudentsForProfessorController");
const ListProfessorsForCoordinatorController_1 = require("../../controllers/admin/coordinator/ListProfessorsForCoordinatorController");
const ListStudentsForCoordinatorController_1 = require("../../controllers/admin/coordinator/ListStudentsForCoordinatorController");
const ListStudentsByDisciplineForCoordinatorController_1 = require("../../controllers/admin/coordinator/ListStudentsByDisciplineForCoordinatorController");
const ListDisciplinesForCoordinatorController_1 = require("../../controllers/admin/coordinator/ListDisciplinesForCoordinatorController");
const ListClassesForCoordinatorController_1 = require("../../controllers/admin/coordinator/ListClassesForCoordinatorController");
const DeleteStudenetController_1 = require("../../controllers/admin/admin/DeleteStudenetController");
const ListStudentsByClassControllerForCoordinatorController_1 = require("../../controllers/admin/coordinator/ListStudentsByClassControllerForCoordinatorController");
const adminRouter = (0, express_1.Router)();
exports.adminRouter = adminRouter;
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
adminRouter.post("/professor", ...isPermissions_1.isPermissions.isAdmin(), new CreateProfessorController_1.CreateProfessorController().handle);
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
adminRouter.delete("/professor/:professorId", ...isPermissions_1.isPermissions.isAdmin(), new DeleteProfessorController_1.DeleteProfessorController().handle);
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
adminRouter.get("/professors", ...isPermissions_1.isPermissions.isAdmin(), new ListAllProfessorsController_1.ListAllProfessorsController().handle);
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
adminRouter.get("/university/:schoolId/professors", ...isPermissions_1.isPermissions.isAdmin(), new ListProfessorsByUniversityController_1.ListProfessorsByUniversityController().handle);
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
adminRouter.get("/course/:courseId/professors", ...isPermissions_1.isPermissions.isAdminOrCoordinator(), new ListProfessorsByCourseController_1.ListProfessorsByCourseController().handle);
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
adminRouter.patch("/professor/:id/role", ...isPermissions_1.isPermissions.isAdmin(), new UpdateProfessorRoleController_1.UpdateProfessorRoleController().handle);
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
adminRouter.get("/students", ...isPermissions_1.isPermissions.isAuthenticated(), new ListStudentsController_1.ListStudentsController().handle);
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
adminRouter.get("/professor/students", ...isPermissions_1.isPermissions.isAuthenticated(), ListStudentsForProfessorController_1.ListStudentsForProfessorController);
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
adminRouter.get("/coordinator/professors", ...isPermissions_1.isPermissions.isAdminOrCoordinator(), ListProfessorsForCoordinatorController_1.ListProfessorsForCoordinatorController);
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
adminRouter.get("/coordinator/students", ...isPermissions_1.isPermissions.isAdminOrCoordinator(), ListStudentsForCoordinatorController_1.ListStudentsForCoordinatorController);
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
adminRouter.get("/coordinator/students/discipline/:disciplineId", ...isPermissions_1.isPermissions.isAdminOrCoordinator(), ListStudentsByDisciplineForCoordinatorController_1.ListStudentsByDisciplineForCoordinatorController);
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
adminRouter.get("/coordinator/disciplines", ...isPermissions_1.isPermissions.isAdminOrCoordinator(), ListDisciplinesForCoordinatorController_1.ListDisciplinesForCoordinatorController);
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
adminRouter.get("/coordinator/classes", ...isPermissions_1.isPermissions.isAdminOrCoordinator(), ListClassesForCoordinatorController_1.ListClassesForCoordinatorController);
adminRouter.get("/classes/:classId/students", ...isPermissions_1.isPermissions.isAdminOrCoordinator(), ListStudentsByClassControllerForCoordinatorController_1.ListStudentsByClassForCoordinatorController);
adminRouter.delete("/coordinator/student", ...isPermissions_1.isPermissions.isAdmin(), DeleteStudenetController_1.deleteStudentController);
