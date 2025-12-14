import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { ChatHistoryController } from "../../controllers/bot/chat/chatHistoryController";

const historyRouter = Router();
const historyController = new ChatHistoryController();

historyRouter.get(
  "/chat/sessions/:userId",
  ...isPermissions.isAuthenticated(),
  historyController.handleGetSessions
);

historyRouter.get(
  "/chat/messages/:userId/:sessionId",
  ...isPermissions.isAuthenticated(),
  historyController.handleGetMessages
);

export { historyRouter };