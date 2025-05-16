import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";

import { LogsStudentAccuracyController } from "../../controllers/Logs/Student/Individual/LogsStudentAccuracyController";
import { LogsStudentUsageController } from "../../controllers/Logs/Student/Individual/LogsStudentUsageController";
import { LogsStudentSubjectSummaryController } from "../../controllers/Logs/Student/Individual/LogsStudentSubjectSummaryController";
import { LogsStudentCompareAccuracyController } from "../../controllers/Logs/Student/Compare/LogsStudentCompareAccuracyController";
import { LogsStudentCompareUsageController } from "../../controllers/Logs/Student/Compare/LogsStudentCompareUsageController";
import { LogsStudentCompareSubjectSummaryController } from "../../controllers/Logs/Student/Compare/LogsStudentCompareSubjectSummaryController";
import { LogsClassAccuracyController } from "../../controllers/Logs/Class/Individual/LogsClassAccuracyController";
import { LogsClassUsageController } from "../../controllers/Logs/Class/Individual/LogsClassUsageController";
import { LogsClassSubjectSummaryController } from "../../controllers/Logs/Class/Individual/LogsClassSubjectSummaryController";
import { LogsClassCompareAccuracyController } from "../../controllers/Logs/Class/Compare/LogsClassCompareAccuracyController";
import { LogsClassCompareUsageController } from "../../controllers/Logs/Class/Compare/LogsClassCompareUsageController";
import { LogsClassCompareSubjectSummaryController } from "../../controllers/Logs/Class/Compare/LogsClassCompareSubjectSummaryController";
import { LogsCourseAccuracyController } from "../../controllers/Logs/Course/Individual/LogsCourseAccuracyController";
import { LogsCourseUsageController } from "../../controllers/Logs/Course/Individual/LogsCourseUsageController";
import { LogsCourseSubjectSummaryController } from "../../controllers/Logs/Course/Individual/LogsCourseSubjectSummaryController";
import { LogsCourseCompareAccuracyController } from "../../controllers/Logs/Course/Compare/LogsCourseCompareAccuracyController";
import { LogsCourseCompareUsageController } from "../../controllers/Logs/Course/Compare/LogsCourseCompareUsageController";
import { LogsCourseCompareSubjectSummaryController } from "../../controllers/Logs/Course/Compare/LogsCourseCompareSubjectSummaryController";
import { LogsDisciplineAccuracyController } from "../../controllers/Logs/Discipline/Individual/LogsDisciplineAccuracyController";
import { LogsDisciplineUsageController } from "../../controllers/Logs/Discipline/Individual/LogsDisciplineUsageController";
import { LogsDisciplineSubjectSummaryController } from "../../controllers/Logs/Discipline/Individual/LogsDisciplineSubjectSummaryController";
import { LogsDisciplineCompareAccuracyController } from "../../controllers/Logs/Discipline/Compare/LogsDisciplineCompareAccuracyController";
import { LogsDisciplineCompareUsageController } from "../../controllers/Logs/Discipline/Compare/LogsDisciplineCompareUsageController";
import { LogsDisciplineCompareSubjectsSummaryController } from "../../controllers/Logs/Discipline/Compare/LogsDisciplineCompareSubjectsSummaryController";
import { LogsUniversityAccuracyController } from "../../controllers/Logs/University/Individual/LogsUniversityAccuracyController";
import { LogsUniversityUsageController } from "../../controllers/Logs/University/Individual/LogsUniversityUsageController";
import { LogsUniversitySubjectSummaryController } from "../../controllers/Logs/University/Individual/LogsUniversitySubjectSummaryController";
import { LogsUniversityCompareAccuracyController } from "../../controllers/Logs/University/Compare/LogsUniversityCompareAccuracyController";
import { LogsUniversityCompareUsageController } from "../../controllers/Logs/University/Compare/LogsUniversityCompareUsageController";
import { LogsUniversityCompareSubjectSummaryController } from "../../controllers/Logs/University/Compare/LogsUniversityCompareSubjectSummaryController";

const logRoutes = Router();

// STUDENT
logRoutes.get("/student/:id/accuracy", isPermissions.isAdminProfessorOrCoordinator(), LogsStudentAccuracyController);
logRoutes.get("/student/:id/usage", isPermissions.isAdminProfessorOrCoordinator(), LogsStudentUsageController);
logRoutes.get("/student/:id/subjects/summary", isPermissions.isAdminProfessorOrCoordinator(), LogsStudentSubjectSummaryController);
logRoutes.post("/student/compare/accuracy", isPermissions.isAdminProfessorOrCoordinator(), LogsStudentCompareAccuracyController);
logRoutes.post("/student/compare/usage", isPermissions.isAdminProfessorOrCoordinator(), LogsStudentCompareUsageController);
logRoutes.post("/student/compare/subjects/summary", isPermissions.isAdminProfessorOrCoordinator(), LogsStudentCompareSubjectSummaryController);

// CLASS
logRoutes.get("/class/:id/accuracy", isPermissions.isAdminProfessorOrCoordinator(), LogsClassAccuracyController);
logRoutes.get("/class/:id/usage", isPermissions.isAdminProfessorOrCoordinator(), LogsClassUsageController);
logRoutes.get("/class/:id/subjects/summary", isPermissions.isAdminProfessorOrCoordinator(), LogsClassSubjectSummaryController);
logRoutes.post("/class/compare/accuracy", isPermissions.isAdminProfessorOrCoordinator(), LogsClassCompareAccuracyController);
logRoutes.post("/class/compare/usage", isPermissions.isAdminProfessorOrCoordinator(), LogsClassCompareUsageController);
logRoutes.post("/class/compare/subjects/summary", isPermissions.isAdminProfessorOrCoordinator(), LogsClassCompareSubjectSummaryController);

// COURSE
logRoutes.get("/course/:id/accuracy", isPermissions.isAdminProfessorOrCoordinator(), LogsCourseAccuracyController);
logRoutes.get("/course/:id/usage", isPermissions.isAdminProfessorOrCoordinator(), LogsCourseUsageController);
logRoutes.get("/course/:id/subjects/summary", isPermissions.isAdminProfessorOrCoordinator(), LogsCourseSubjectSummaryController);
logRoutes.post("/course/compare/accuracy", isPermissions.isAdminProfessorOrCoordinator(), LogsCourseCompareAccuracyController);
logRoutes.post("/course/compare/usage", isPermissions.isAdminProfessorOrCoordinator(), LogsCourseCompareUsageController);
logRoutes.post("/course/compare/subjects/summary", isPermissions.isAdminProfessorOrCoordinator(), LogsCourseCompareSubjectSummaryController);

// DISCIPLINE
logRoutes.get("/discipline/:id/accuracy", isPermissions.isAdminProfessorOrCoordinator(), LogsDisciplineAccuracyController);
logRoutes.get("/discipline/:id/usage", isPermissions.isAdminProfessorOrCoordinator(), LogsDisciplineUsageController);
logRoutes.get("/discipline/:id/subjects/summary", isPermissions.isAdminProfessorOrCoordinator(), LogsDisciplineSubjectSummaryController);
logRoutes.post("/discipline/compare/accuracy", isPermissions.isAdminProfessorOrCoordinator(), LogsDisciplineCompareAccuracyController);
logRoutes.post("/discipline/compare/usage", isPermissions.isAdminProfessorOrCoordinator(), LogsDisciplineCompareUsageController);
logRoutes.post("/discipline/compare/subjects/summary", isPermissions.isAdminProfessorOrCoordinator(), LogsDisciplineCompareSubjectsSummaryController);

// UNIVERSITY
logRoutes.get("/university/:id/accuracy", isPermissions.isAdminProfessorOrCoordinator(), LogsUniversityAccuracyController);
logRoutes.get("/university/:id/usage", isPermissions.isAdminProfessorOrCoordinator(), LogsUniversityUsageController);
logRoutes.get("/university/:id/subjects/summary", isPermissions.isAdminProfessorOrCoordinator(), LogsUniversitySubjectSummaryController);
logRoutes.post("/university/compare/accuracy", isPermissions.isAdminProfessorOrCoordinator(), LogsUniversityCompareAccuracyController);
logRoutes.post("/university/compare/usage", isPermissions.isAdminProfessorOrCoordinator(), LogsUniversityCompareUsageController);
logRoutes.post("/university/compare/subjects/summary", isPermissions.isAdminProfessorOrCoordinator(), LogsUniversityCompareSubjectSummaryController);

export { logRoutes };
