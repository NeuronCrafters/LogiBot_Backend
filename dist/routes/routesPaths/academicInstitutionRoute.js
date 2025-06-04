"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.academicInstitutionRouter = void 0;
const express_1 = require("express");
const isPermissions_1 = require("../../middlewares/isPermissions/isPermissions");
const CreateClassController_1 = require("../../controllers/University/Class/CreateClassController");
const DeleteClassController_1 = require("../../controllers/University/Class/DeleteClassController");
const ListClassesByCourseController_1 = require("../../controllers/University/Class/ListClassesByCourseController");
const CreateCourseController_1 = require("../../controllers/University/Course/CreateCourseController");
const DeleteCourseController_1 = require("../../controllers/University/Course/DeleteCourseController");
const ListCoursesByUniversityController_1 = require("../../controllers/University/Course/ListCoursesByUniversityController");
const CreateDisciplineController_1 = require("../../controllers/University/Discipline/CreateDisciplineController");
const DeleteDisciplineController_1 = require("../../controllers/University/Discipline/DeleteDisciplineController");
const ListDisciplinesController_1 = require("../../controllers/University/Discipline/ListDisciplinesController");
const CreateUniversityController_1 = require("../../controllers/University/University/CreateUniversityController");
const DeleteUniversityController_1 = require("../../controllers/University/University/DeleteUniversityController");
const ListUniversitiesController_1 = require("../../controllers/University/University/ListUniversitiesController");
const academicInstitutionRouter = (0, express_1.Router)();
exports.academicInstitutionRouter = academicInstitutionRouter;
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
// Rotas para Universidades (Somente Admin)
academicInstitutionRouter.post("/university", ...isPermissions_1.isPermissions.isAdmin(), new CreateUniversityController_1.CreateUniversityController().handle);
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
academicInstitutionRouter.get("/university", ...isPermissions_1.isPermissions.isAdmin(), new ListUniversitiesController_1.ListUniversitiesController().handle);
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
academicInstitutionRouter.delete("/university/:universityId", ...isPermissions_1.isPermissions.isAdmin(), new DeleteUniversityController_1.DeleteUniversityController().handle);
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
// Rotas para Cursos (Somente Admin)
academicInstitutionRouter.post("/course", ...isPermissions_1.isPermissions.isAdmin(), new CreateCourseController_1.CreateCourseController().handle);
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
academicInstitutionRouter.get("/course/:universityId", ...isPermissions_1.isPermissions.isAdmin(), new ListCoursesByUniversityController_1.ListCoursesByUniversityController().handle);
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
academicInstitutionRouter.delete("/course/:courseId", ...isPermissions_1.isPermissions.isAdmin(), new DeleteCourseController_1.DeleteCourseController().handle);
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
// Rotas para Turmas (Admin e Coordenadores)
academicInstitutionRouter.post("/class", ...isPermissions_1.isPermissions.isAdminOrCoordinator(), new CreateClassController_1.CreateClassController().handle);
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
academicInstitutionRouter.get("/class/:courseId", ...isPermissions_1.isPermissions.isAdminOrCoordinator(), new ListClassesByCourseController_1.ListClassesByCourseController().handle);
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
academicInstitutionRouter.delete("/class/:classId", ...isPermissions_1.isPermissions.isAdminOrCoordinator(), new DeleteClassController_1.DeleteClassController().handle);
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
// Rotas para Disciplinas (Admin e Coordenadores)
academicInstitutionRouter.post("/discipline", ...isPermissions_1.isPermissions.isAdminOrCoordinator(), new CreateDisciplineController_1.CreateDisciplineController().handle);
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
academicInstitutionRouter.get("/discipline", ...isPermissions_1.isPermissions.isAdminOrCoordinator(), new ListDisciplinesController_1.ListDisciplinesController().handle);
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
academicInstitutionRouter.delete("/discipline/:disciplineId", ...isPermissions_1.isPermissions.isAdminOrCoordinator(), new DeleteDisciplineController_1.DeleteDisciplineController().handle);
