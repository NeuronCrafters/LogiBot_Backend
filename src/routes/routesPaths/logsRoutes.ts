import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { LogsUniversitySummaryController } from "../../controllers/Logs/University/LogsUniversitySummaryController";
import { LogsCourseSummaryController } from "../../controllers/Logs/Course/LogsCourseSummaryController";
import { LogsClassSummaryController } from "../../controllers/Logs/Class/LogsClassSummaryController";
import { LogsFilteredStudentSummaryController } from "../../controllers/Logs/Student/LogsFilteredStudentSummaryController";

import {
  ProfessorListStudentsController,
  ProfessorGetStudentDetailsController,
  ProfessorStudentsStatsController
} from "../../controllers/Logs/Student/ProfessorStudentsController"

const logRoutes = Router();
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

logRoutes.get(
  "/professor/students",
  isPermissions.isAdminProfessorOrCoordinator(),
  ProfessorListStudentsController
);

logRoutes.get(
  "/professor/students/:studentId",
  isPermissions.isAdminProfessorOrCoordinator(),
  ProfessorGetStudentDetailsController
);

logRoutes.get(
  "/professor/students-stats",
  isPermissions.isAdminProfessorOrCoordinator(),
  ProfessorStudentsStatsController
);


export { logRoutes };
