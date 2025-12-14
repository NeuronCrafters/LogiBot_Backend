import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { ChatHistoryController } from "../../controllers/bot/chat/chatHistoryController";

const historyRouter = Router();
const historyController = new ChatHistoryController();

/**
 * @swagger
 * tags:
 * name: ChatHistory
 * description: Gerenciamento do histórico de conversas do Chat
 */

/**
 * @swagger
 * /history/chat/sessions/{userId}:
 * get:
 * summary: Lista todas as sessões de conversa de um usuário
 * tags: [ChatHistory]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: userId
 * required: true
 * schema:
 * type: string
 * description: ID do usuário
 * responses:
 * 200:
 * description: Lista de sessões retornada com sucesso
 */
historyRouter.get(
  "/chat/sessions/:userId",
  ...isPermissions.isAuthenticated(),
  historyController.handleGetSessions
);

/**
 * @swagger
 * /history/chat/messages/{userId}/{sessionId}:
 * get:
 * summary: Retorna o histórico completo de mensagens de uma sessão específica
 * tags: [ChatHistory]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: userId
 * required: true
 * schema:
 * type: string
 * - in: path
 * name: sessionId
 * required: true
 * schema:
 * type: string
 * description: ID da sessão de chat
 * responses:
 * 200:
 * description: Histórico de mensagens retornado com sucesso
 */
historyRouter.get(
  "/chat/messages/:userId/:sessionId",
  ...isPermissions.isAuthenticated(),
  historyController.handleGetMessages
);

export { historyRouter };