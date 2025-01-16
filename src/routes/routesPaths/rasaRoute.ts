import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated/isAuthenticated";
import { isAuthorized } from "../../middlewares/isAuthorized/isAuthorized";
import { RasaSendController } from "../../controllers/rasa/rasaSendController";
import { RasaGetHistoryController } from "../../controllers/rasa/rasaGetHistoryController";

const rasaRouter = Router();

// Instâncias dos controladores
const rasaSendController = new RasaSendController();
const rasaGetHistoryController = new RasaGetHistoryController();

// Rota de conversa com o SAEL
rasaRouter.post("/talk", isAuthenticated, rasaSendController.handle.bind(rasaSendController));

// Rota para obter o histórico de conversa
rasaRouter.get("/history", isAuthenticated, isAuthorized(["admin", "professor", "course-coordinator"]), rasaGetHistoryController.handle.bind(rasaGetHistoryController)
);

export { rasaRouter };
