import { Router } from "express";
import { authRoute } from "./routesPaths/authRoute";
import { adminRouter } from "./routesPaths/adminRoute";
import { professorRouter } from "./routesPaths/professorRoute";
import { isAuthenticated } from "../middlewares/isAuthenticated";
import { isAuthorized } from "../middlewares/isAuthorized";
import passport from "passport";

const routes = Router();

routes.use("/", authRoute);

routes.use("/admin", isAuthenticated, isAuthorized("admin"), adminRouter);
routes.use("/professor", isAuthenticated, isAuthorized("professor"), professorRouter);

routes.use(passport.initialize());
routes.use(passport.session());

export { routes };
