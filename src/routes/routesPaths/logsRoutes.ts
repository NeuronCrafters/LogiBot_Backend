import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";

import { LogsUniversitySummaryController } from "../../controllers/Logs/University/LogsUniversitySummaryController";
import { LogsCourseSummaryController } from "../../controllers/Logs/Course/LogsCourseSummaryController";
import { LogsClassSummaryController } from "../../controllers/Logs/Class/LogsClassSummaryController";
import { LogsFilteredStudentSummaryController } from "../../controllers/Logs/Student/LogsFilteredStudentSummaryController";

//Controller dedicaco a professores
import {
  ProfessorListStudentsController,
  ProfessorGetStudentDetailsController,
  ProfessorStudentsStatsController
} from "../../controllers/Logs/Student/ProfessorStudentsController"

const logRoutes = Router();
//ROTAS DE DADOS INDIVIDUAIS
logRoutes.get(
  "/university/:universityId/summary",
  isPermissions.isAdmin(),
  LogsUniversitySummaryController
);

logRoutes.get(
  "/course/:courseId/summary",
  isPermissions.isAdminProfessorOrCoordinator(),
  LogsCourseSummaryController
);

logRoutes.get(
  "/class/:classId/summary",
  isPermissions.isAdminProfessorOrCoordinator(),
  LogsClassSummaryController
);

logRoutes.post(
  "/student/summary/filtered",
  isPermissions.isAdminProfessorOrCoordinator(),
  LogsFilteredStudentSummaryController
);

// ROTAS ESPECÍFICAS PARA PROFESSOR
// Lista todos os alunos das disciplinas do professor (com filtros opcionais)
logRoutes.get(
  "/professor/students",
  isPermissions.isAdminProfessorOrCoordinator(),
  ProfessorListStudentsController
);

// Obtém dados de um aluno específico (validando que está nas disciplinas do professor)
logRoutes.get(
  "/professor/students/:studentId",
  isPermissions.isAdminProfessorOrCoordinator(),
  ProfessorGetStudentDetailsController
);

// Obtém estatísticas agregadas dos alunos do professor
logRoutes.get(
  "/professor/students-stats",
  isPermissions.isAdminProfessorOrCoordinator(),
  ProfessorStudentsStatsController
);

// ROTA DE DEBUG - REMOVER DEPOIS
logRoutes.get("/test", (req, res) => {
  res.json({ message: "Log routes are working!" });
});

export { logRoutes };
