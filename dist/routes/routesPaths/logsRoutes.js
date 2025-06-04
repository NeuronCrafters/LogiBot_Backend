"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logRoutes = void 0;
const express_1 = require("express");
const isPermissions_1 = require("../../middlewares/isPermissions/isPermissions");
const LogsUniversitySummaryController_1 = require("../../controllers/Logs/University/LogsUniversitySummaryController");
const LogsCourseSummaryController_1 = require("../../controllers/Logs/Course/LogsCourseSummaryController");
const LogsClassSummaryController_1 = require("../../controllers/Logs/Class/LogsClassSummaryController");
const LogsFilteredStudentSummaryController_1 = require("../../controllers/Logs/Student/LogsFilteredStudentSummaryController");
const LogsUniversitiesComparisonController_1 = require("../../controllers/Logs/University/LogsUniversitiesComparisonController");
const LogsCoursesComparisonController_1 = require("../../controllers/Logs/Course/LogsCoursesComparisonController");
const LogsClassComparisonController_1 = require("../../controllers/Logs/Class/LogsClassComparisonController");
const LogsStudentsComparisonController_1 = require("../../controllers/Logs/Student/LogsStudentsComparisonController");
const logRoutes = (0, express_1.Router)();
exports.logRoutes = logRoutes;
//ROTAS DE DADOS INDIVIDUAIS
logRoutes.get("/university/:universityId/summary", isPermissions_1.isPermissions.isAdmin(), LogsUniversitySummaryController_1.LogsUniversitySummaryController);
logRoutes.get("/course/:courseId/summary", isPermissions_1.isPermissions.isAdminProfessorOrCoordinator(), LogsCourseSummaryController_1.LogsCourseSummaryController);
logRoutes.get("/class/:classId/summary", isPermissions_1.isPermissions.isAdminProfessorOrCoordinator(), LogsClassSummaryController_1.LogsClassSummaryController);
logRoutes.post("/student/summary/filtered", isPermissions_1.isPermissions.isAdminProfessorOrCoordinator(), LogsFilteredStudentSummaryController_1.LogsFilteredStudentSummaryController);
// ROTAS PARA COMPARAÇÃO
logRoutes.post("/comparison/universities", isPermissions_1.isPermissions.isAdmin(), LogsUniversitiesComparisonController_1.LogsUniversitiesComparisonController);
logRoutes.post("/comparison/courses", isPermissions_1.isPermissions.isAdminProfessorOrCoordinator(), LogsCoursesComparisonController_1.LogsCoursesComparisonController);
logRoutes.post("/comparison/class", isPermissions_1.isPermissions.isAdminProfessorOrCoordinator(), LogsClassComparisonController_1.LogsClassesComparisonController);
logRoutes.post("/comparison/students", isPermissions_1.isPermissions.isAdminProfessorOrCoordinator(), LogsStudentsComparisonController_1.LogsStudentsComparisonController);
