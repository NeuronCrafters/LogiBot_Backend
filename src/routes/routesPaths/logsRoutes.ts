import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";

import { LogsUniversitySummaryController } from "../../controllers/Logs/University/LogsUniversitySummaryController";
import { LogsCourseSummaryController } from "../../controllers/Logs/Course/LogsCourseSummaryController";
import { LogsClassSummaryController } from "../../controllers/Logs/Class/LogsClassSummaryController";
import { LogsFilteredStudentSummaryController } from "../../controllers/Logs/Student/LogsFilteredStudentSummaryController";
import { LogsUniversitiesComparisonController } from "../../controllers/Logs/University/LogsUniversitiesComparisonController";
import { LogsCoursesComparisonController } from "../../controllers/Logs/Course/LogsCoursesComparisonController";
import { LogsClassesComparisonController } from "../../controllers/Logs/Class/LogsClassComparisonController";
import { LogsStudentsComparisonController } from "../../controllers/Logs/Student/LogsStudentsComparisonController";

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

// ROTAS PARA COMPARAÇÃO
logRoutes.post(
  "/comparison/universities",
  isPermissions.isAdmin(),
  LogsUniversitiesComparisonController
);

logRoutes.post(
  "/comparison/courses",
  isPermissions.isAdminProfessorOrCoordinator(),
  LogsCoursesComparisonController
);

logRoutes.post(
  "/comparison/classes",
  isPermissions.isAdminProfessorOrCoordinator(),
  LogsClassesComparisonController
);

logRoutes.post(
  "/comparison/students",
  isPermissions.isAdminProfessorOrCoordinator(),
  LogsStudentsComparisonController
);

export { logRoutes };
