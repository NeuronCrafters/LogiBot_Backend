"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.academicRoutes = void 0;
const express_1 = require("express");
const getAcademicDataController_1 = require("../../controllers/University/getAcademicDataController");
const isPermissions_1 = require("../../middlewares/isPermissions/isPermissions");
const academicRoutes = (0, express_1.Router)();
exports.academicRoutes = academicRoutes;
/**
 * @swagger
 * /api/academic/data:
 *   get:
 *     tags: [Dados Acadêmicos]
 *     summary: Buscar todos os dados acadêmicos baseado nas permissões do usuário
 *     security:
 *       - cookieAuth: []
 *     description: |
 *       **Retorna dados filtrados por papel:**
 *       - **ADMIN**: Todas as universidades, cursos, turmas, disciplinas, professores e estudantes
 *       - **COORDENADOR**: Dados do curso que coordena (turmas, disciplinas, professores, estudantes)
 *       - **PROFESSOR**: Disciplinas que leciona e estudantes dessas disciplinas
 *       - **ESTUDANTE**: Acesso negado automaticamente pelo middleware
 *     responses:
 *       200:
 *         description: Dados acadêmicos estruturados
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso negado
 *       500:
 *         description: Erro interno
 */
academicRoutes.get("/data", ...isPermissions_1.isPermissions.isAdminProfessorOrCoordinator(), getAcademicDataController_1.getAcademicDataController);
