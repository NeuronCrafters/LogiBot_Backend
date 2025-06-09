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

const routes = Router();

// Rotas públicas (sem autenticação)
routes.use("/", authRoute);
routes.use("/", socialLoginRoute);

// A partir daqui exige autenticação para as rotas
routes.use(isAuthenticated);

// Rotas protegidas
routes.use("/admin", adminRouter);
routes.use("/password", passwordRouter);
routes.use("/sael", rasaRouter);
routes.use("/logs", logRoutes);
routes.use("/academic-institution", academicInstitutionRouter);
routes.use("/academicFilters", academicRoutes);
routes.use("/useranalysis", useAnalysis);

export { routes };
