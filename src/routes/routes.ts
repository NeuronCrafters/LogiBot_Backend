import { Router } from "express";
import { isAuthenticated } from "../middlewares/isAuthenticated/isAuthenticated";
import { authRoute } from "./routesPaths/authRoute";
import { socialLoginRoute } from "./routesPaths/socialLoginRoute";
import { adminRouter } from "./routesPaths/adminRoute";
import { passwordRouter } from "./routesPaths/passwordRoute";
import { rasaRouter } from "./routesPaths/rasaRoute";
import { academicInstitutionRouter } from "./routesPaths/academicInstitutionRoute";
import { academicRoutes } from "./routesPaths/academicRoutes";
import { logRoutes } from "./routesPaths/logsRoutes";
import { useAnalysis } from "./routesPaths/userAnalysisRoutes";
import { healthRoutes } from "./routesPaths/healthRoutes";

const routes = Router();

// Rotas de saúde do sistema (health checks)
routes.use(healthRoutes);

routes.use("/", authRoute);
routes.use("/", socialLoginRoute);

routes.use("/password", passwordRouter);

routes.use(isAuthenticated);
routes.use("/admin", adminRouter);
routes.use("/sael", rasaRouter);
routes.use("/logs", logRoutes);
routes.use("/academic-institution", academicInstitutionRouter);
routes.use("/academicFilters", academicRoutes);
routes.use("/useranalysis", useAnalysis);

export { routes };
