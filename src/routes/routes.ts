import { Router } from "express";
import { authRoute } from "./routesPaths/authRoute";
import { socialLoginRoute } from "./routesPaths/socialLoginRoute";
import { adminRouter } from "./routesPaths/adminRoute";
import { professorRouter } from "./routesPaths/professorRoute";
import { passwordRouter } from "./routesPaths/resetPasswordRoutes";
import { rasaRouter } from "./routesPaths/rasaRoute";
import { isAuthenticated } from "../middlewares/isAuthenticated/isAuthenticated";
import { isAuthorized } from "../middlewares/isAuthorized/isAuthorized";
import { academicInstitutionRouter } from "./routesPaths/academicInstitution";

const routes = Router();

// Rotas de autenticação
routes.use("/", authRoute);

// Rotas de login social
routes.use("/", socialLoginRoute);

// Rotas protegidas para admin e coordenador de curso
routes.use("/admin", isAuthenticated, isAuthorized(["admin", "course-coordinator"]), adminRouter);

// Rotas protegidas para professor
routes.use("/professor", isAuthenticated, isAuthorized(["admin", "course-coordinator"]), professorRouter);

// Rotas de redefinição de senha
routes.use("/password", passwordRouter);

// Rotas do Rasa
routes.use("/sael", rasaRouter);

// Rotas de instituições acadêmicas
routes.use("/academic-institution", isAuthenticated, academicInstitutionRouter);


export { routes };
