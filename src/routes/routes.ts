import { Router } from "express";
import { authRoute } from "./routesPaths/authRoute";
import { socialLoginRoute } from "./routesPaths/socialLoginRoute";
import { adminRouter } from "./routesPaths/adminRoute";
import { professorRouter } from "./routesPaths/professorRoute";
import { isAuthenticated } from "../middlewares/isAuthenticated";
import { isAuthorized } from "../middlewares/isAuthorized";

const routes = Router();

// Rotas de autenticação
routes.use("/", authRoute);

// Rotas de login social
routes.use("/", socialLoginRoute);

// Rotas protegidas para admin
routes.use("/admin", isAuthenticated, isAuthorized("admin"), adminRouter);

// Rotas protegidas para professor
routes.use("/professor", isAuthenticated, isAuthorized("professor"), professorRouter);

export { routes };
