import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated/isAuthenticated";
import { RasaSendController } from "../../controllers/rasa/rasaSendController";
import { RasaGetHistoryController } from "../../controllers/rasa/rasaGetHistoryController";
import { isAuthorized } from "../../middlewares/isAuthorized/isAuthorized";

const rasaRouter = Router();

// Instâncias dos controladores para resolver bug de comunicação com o rasa
const rasaSendController = new RasaSendController();
const rasaGetHistoryController = new RasaGetHistoryController();

// rota de conversa
rasaRouter.post("/talk", isAuthenticated, rasaSendController.handle.bind(rasaSendController));

// rotas ainda em teste
// rota para pegar o historico da conversa
rasaRouter.get("/history", isAuthenticated, isAuthorized, rasaGetHistoryController.handle.bind(rasaGetHistoryController));

export { rasaRouter };
