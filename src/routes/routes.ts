import { Router } from "express";
import { requireApiKey } from "../http/auth";
import { accountRouter } from "./modules/accountRoutes";
import { academicRouter } from "./modules/academicRoutes";
import { adminRouter } from "./modules/adminRoutes";
import { analyticsRouter } from "./modules/analyticsRoutes";
import { authRouter } from "./modules/authRoutes";
import { chatRouter } from "./modules/chatRoutes";
import { dashboardRouter } from "./modules/dashboardRoutes";
import { feedbackRouter } from "./modules/feedbackRoutes";
import { healthRouter } from "./modules/healthRoutes";
import { logRouter } from "./modules/logRoutes";
import { quizRouter } from "./modules/quizRoutes";

const routes = Router();

routes.use("/health", healthRouter);

routes.use(requireApiKey);

routes.use("/auth", authRouter);
routes.use("/account", accountRouter);
routes.use("/quiz", quizRouter);
routes.use("/chat", chatRouter);
routes.use("/academic", academicRouter);
routes.use("/admin", adminRouter);
routes.use("/analytics", analyticsRouter);
routes.use("/dashboard", dashboardRouter);
routes.use("/logs", logRouter);
routes.use("/feedback", feedbackRouter);

routes.use((req, res) => res.status(404).json({ success: false, message: "rota nao encontrada", path: req.path }));

export { routes };
