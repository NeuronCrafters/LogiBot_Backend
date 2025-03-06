import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { RasaSendController } from "../../controllers/rasa/rasaSendController";
import { RasaGetHistoryController } from "../../controllers/rasa/rasaGetHistoryController";

const rasaRouter = Router();

const rasaSendController = new RasaSendController();
const rasaGetHistoryController = new RasaGetHistoryController();

// Rota de conversa com o SAEL (somente usuários autenticados)
rasaRouter.post("/talk", ...isPermissions.isAuthenticated(), rasaSendController.handle.bind(rasaSendController));

// Rota para obter o histórico de conversa (somente Admin, Professores e Coordenadores)
rasaRouter.get("/history", ...isPermissions.isAdminProfessorOrCoordinator(), rasaGetHistoryController.handle.bind(rasaGetHistoryController));

export { rasaRouter };
