import { getLanguage, SUPPORTED_LANGUAGES } from "../i18n";
import { t } from "../i18n";
import { Router } from "express";
import { requireApiKey, requireAuth } from "../http/auth";
import { practiceFeature, requireFeature } from "../services/features/featureService";
import { featureRouter } from "./modules/featureRoutes";
import { devRouter } from "./modules/devRoutes";
import { accountRouter } from "./modules/accountRoutes";
import { academicRouter } from "./modules/academicRoutes";
import { adminRouter } from "./modules/adminRoutes";
import { analyticsRouter } from "./modules/analyticsRoutes";
import { authRouter } from "./modules/authRoutes";
import { chatRouter } from "./modules/chatRoutes";
import { dashboardRouter } from "./modules/dashboardRoutes";
import { exerciseRouter } from "./modules/exerciseRoutes";
import { feedbackRouter } from "./modules/feedbackRoutes";
import { healthRouter } from "./modules/healthRoutes";
import { logRouter } from "./modules/logRoutes";
import { notificationRouter } from "./modules/notificationRoutes";
import { chatFeedbackRouter } from "./modules/chatFeedbackRoutes";
import { questionBankRouter } from "./modules/questionBankRoutes";
import { examRouter } from "./modules/examRoutes";
import { quizRouter } from "./modules/quizRoutes";
import { professorQuizRouter } from "./modules/professorQuizRoutes";
import { conceptRouter } from "./modules/conceptRoutes";
import { institutionRouter } from "./modules/institutionRoutes";
import { institutionImageRouter } from "./modules/institutionImageRoutes";
import { ragRouter } from "./modules/ragRoutes";

const routes = Router();

routes.use("/health", healthRouter);
// Institution photos and covers: read-only files named by their hash (an <img> sends no API key).
routes.use("/institution-images", institutionImageRouter);

routes.use(requireApiKey);

routes.get("/languages", (_req, res) => res.json({
  language: getLanguage(),
  languages: SUPPORTED_LANGUAGES,
}));

routes.use("/auth", authRouter);
routes.use("/account", accountRouter);
routes.use("/quiz", requireAuth, requireFeature("quiz"), quizRouter);
routes.use("/quiz/professor", professorQuizRouter);
routes.use("/chat", requireAuth, requireFeature("chat"), chatRouter);
routes.use("/academic", academicRouter);
routes.use("/admin", adminRouter);
routes.use("/analytics", analyticsRouter);
routes.use("/dashboard", requireAuth, requireFeature("dashboard"), dashboardRouter);
routes.use("/logs", logRouter);
routes.use("/feedback", requireAuth, requireFeature("feedback"), feedbackRouter);
routes.use("/rag", requireAuth, requireFeature("rag"), ragRouter);
routes.use("/exercises", requireAuth, requireFeature(practiceFeature), exerciseRouter);
routes.use("/notifications", requireAuth, requireFeature("notifications"), notificationRouter);
routes.use("/chat-feedback", requireAuth, requireFeature("chat"), chatFeedbackRouter);
routes.use("/questions", requireAuth, requireFeature("question_bank"), questionBankRouter);
routes.use("/exams", requireAuth, requireFeature("exams"), examRouter);
routes.use("/concepts", requireAuth, requireFeature("concept_panel"), conceptRouter);
routes.use("/institutions", requireAuth, requireFeature("institution_page"), institutionRouter);
routes.use("/features", featureRouter);
routes.use("/dev", devRouter);

routes.use((req, res) =>
  res
    .status(404)
    .json({ success: false, message: t("api.routeNotFound"), path: req.path }),
);

export { routes };
