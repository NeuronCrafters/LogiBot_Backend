import { Router } from "express";
import { getAcademicDataController } from "../../controllers/University/getAcademicDataController";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";

const academicRoutes = Router();

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
academicRoutes.get(
  "/data",
  ...isPermissions.isAdminProfessorOrCoordinator(),
  getAcademicDataController
);

/**
 * @swagger
 * /api/academic/health:
 *   get:
 *     tags: [Dados Acadêmicos]
 *     summary: Health check da API acadêmica
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: API funcionando
 *       401:
 *         description: Não autenticado
 */
academicRoutes.get(
  "/health",
  ...isPermissions.isAuthenticated(),
  (req: any, res: any) => {
    const hasAccess = ['admin', 'course-coordinator', 'professor'].some(role =>
      req.user?.role.includes(role)
    );

    res.json({
      status: "healthy",
      message: "API de dados acadêmicos funcionando",
      user: {
        id: req.user?.id,
        name: req.user?.name,
        email: req.user?.email,
        role: req.user?.role,
        hasAccess,
        accessLevel: hasAccess ? (
          req.user.role.includes('admin') ? 'ADMIN' :
            req.user.role.includes('course-coordinator') ? 'COORDINATOR' : 'PROFESSOR'
        ) : 'NO_ACCESS'
      },
      timestamp: new Date().toISOString()
    });
  }
);

export { academicRoutes };