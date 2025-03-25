import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { RasaSendController } from "../../controllers/rasa/rasaSendController";
import { RasaActionController } from "../../controllers/rasa/rasaActionController";


const rasaRouter = Router();

const sendController = new RasaSendController();
const actionController = new RasaActionController();

// Rota para enviar mensagem ao chatbot (somente usuários autenticados)
rasaRouter.post("/talk", ...isPermissions.isAuthenticated(), sendController.handle.bind(sendController));

rasaRouter.get("/action/listar_niveis", ...isPermissions.isAuthenticated(), actionController.listarNiveis.bind(actionController));

rasaRouter.post("/action/definir_nivel", ...isPermissions.isAuthenticated(), actionController.definirNivel.bind(actionController));

rasaRouter.get("/action/listar_opcoes", ...isPermissions.isAuthenticated(), actionController.listarOpcoes.bind(actionController));

rasaRouter.post("/action/listar_subopcoes", ...isPermissions.isAuthenticated(), actionController.sendOpcaoEListarSubopcoes.bind(actionController));

rasaRouter.post("/action/gerar_perguntas", ...isPermissions.isAuthenticated(), actionController.gerarPerguntas.bind(actionController));

rasaRouter.get("/action/gabarito", ...isPermissions.isAuthenticated(), actionController.getGabarito.bind(actionController));

rasaRouter.post("/action/send", ...isPermissions.isAuthenticated(), actionController.verificarRespostas.bind(actionController));

export { rasaRouter };
