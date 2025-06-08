import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";

import { LogsUniversitySummaryController } from "../../controllers/Logs/University/LogsUniversitySummaryController";
import { LogsCourseSummaryController } from "../../controllers/Logs/Course/LogsCourseSummaryController";
import { LogsClassSummaryController } from "../../controllers/Logs/Class/LogsClassSummaryController";
import { LogsFilteredStudentSummaryController } from "../../controllers/Logs/Student/LogsFilteredStudentSummaryController";

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

export { logRoutes };
