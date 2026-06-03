import { Router } from "express";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import {
  getAccessPattern,
  getEffortMatrix,
  getLearningJourney,
  getProficiencyRadar,
  getSessionDetails,
  getTopicPerformance,
} from "../../services/dashboard/dashboardService";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requireRoles(["admin", "professor", "course-coordinator"]));

dashboardRouter.post("/topic-performance", asyncHandler(async (req, res) => {
  return res.json(await getTopicPerformance(req.body));
}));

dashboardRouter.post("/proficiency-radar", asyncHandler(async (req, res) => {
  return res.json(await getProficiencyRadar(req.body));
}));

dashboardRouter.post("/effort-matrix", asyncHandler(async (req, res) => {
  return res.json(await getEffortMatrix(req.body));
}));

dashboardRouter.post("/learning-journey", asyncHandler(async (req, res) => {
  return res.json(await getLearningJourney(req.body));
}));

dashboardRouter.post("/session-details", asyncHandler(async (req, res) => {
  return res.json(await getSessionDetails(req.body));
}));

dashboardRouter.post("/access-pattern", asyncHandler(async (req, res) => {
  return res.json(await getAccessPattern(req.body));
}));
