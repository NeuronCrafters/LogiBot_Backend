import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated/isAuthenticated";
import { RasaSendController } from "../../controllers/rasa/rasaSendController";
import { RasaSaveHistoryController } from "../../controllers/rasa/rasaSaveHistoryController";
import { RasaGetHistoryController } from "../../controllers/rasa/rasaGetHistoryController";

const rasaRouter = Router();

rasaRouter.post("/talk", isAuthenticated, new RasaSendController().handle);
rasaRouter.post("/history", isAuthenticated, new RasaSaveHistoryController().handle);
rasaRouter.get("/history", isAuthenticated, new RasaGetHistoryController().handle);

export { rasaRouter };
