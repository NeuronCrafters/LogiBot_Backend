import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated/isAuthenticated";
import { RasaController } from "../../controllers/rasa/rasaController";

const rasaRouter = Router();
const rasaController = new RasaController();

// Rota para interação com o Rasa
rasaRouter.post("/talk", isAuthenticated, rasaController.handle.bind(rasaController));

export { rasaRouter };
