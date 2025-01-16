import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated/isAuthenticated";
import { RasaSendController } from "../../controllers/rasa/rasaSendController";
import { RasaSaveHistoryController } from "../../controllers/rasa/rasaSaveHistoryController";
import { RasaGetHistoryController } from "../../controllers/rasa/rasaGetHistoryController";

const rasaRouter = Router();

// Instâncias dos controladores para resolver bug de comunicação com o rasa
const rasaSendController = new RasaSendController();
const rasaSaveHistoryController = new RasaSaveHistoryController();
const rasaGetHistoryController = new RasaGetHistoryController();

// rota de conversa
rasaRouter.post("/talk", isAuthenticated, rasaSendController.handle.bind(rasaSendController));

// rotas ainda em teste
// rota para enviar o historico da conversa para o mongo
rasaRouter.post("/history", isAuthenticated, rasaSaveHistoryController.handle.bind(rasaSaveHistoryController));
// rota para pegar o historico da conversa
rasaRouter.get("/history", isAuthenticated, rasaGetHistoryController.handle.bind(rasaGetHistoryController));

export { rasaRouter };
