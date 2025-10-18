import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { GetTopicPerformanceController } from "../../controllers/dashboard/GetTopicPerformanceController";
import { GetEffortMatrixController } from "../../controllers/dashboard/GetEffortMatrixController";
import { GetProficiencyRadarController } from "../../controllers/dashboard/GetProficiencyRadarController";
import { GetLearningJourneyController } from "../../controllers/dashboard/GetLearningJourneyController";
import { GetAccessPatternController } from "../../controllers/dashboard/GetAccessPatternController";
import { GetSessionDetailsController } from "../../controllers/dashboard/GetSessionDetailsController";

const dashboardRoutes = Router();

const topicPerformanceCtrl = new GetTopicPerformanceController();
const effortMatrixCtrl = new GetEffortMatrixController();
const proficiencyRadarCtrl = new GetProficiencyRadarController();
const learningJourneyCtrl = new GetLearningJourneyController();
const accessPatternCtrl = new GetAccessPatternController();
const sessionDetailsCtrl = new GetSessionDetailsController();

dashboardRoutes.post("/topic-performance", isPermissions.isAdminProfessorOrCoordinator(), topicPerformanceCtrl.handle);
dashboardRoutes.post("/effort-matrix", isPermissions.isAdminProfessorOrCoordinator(), effortMatrixCtrl.handle);
dashboardRoutes.post("/proficiency-radar", isPermissions.isAdminProfessorOrCoordinator(), proficiencyRadarCtrl.handle);
dashboardRoutes.post("/learning-journey", isPermissions.isAdminProfessorOrCoordinator(), learningJourneyCtrl.handle);
dashboardRoutes.post("/access-pattern", isPermissions.isAdminProfessorOrCoordinator(), accessPatternCtrl.handle);
dashboardRoutes.post("/session-details", isPermissions.isAdminProfessorOrCoordinator(), sessionDetailsCtrl.handle);

export { dashboardRoutes };