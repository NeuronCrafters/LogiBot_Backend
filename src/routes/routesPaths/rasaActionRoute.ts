import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { RasaActionController } from "../../controllers/rasa/rasaActionController";

const rasaActionRouter = Router();
const actionController = new RasaActionController();

rasaActionRouter.post("/action/iniciar", ...isPermissions.isAuthenticated(), actionController.iniciarBot.bind(actionController));

rasaActionRouter.get("/action/listar_niveis", ...isPermissions.isAuthenticated(), actionController.listarNiveis.bind(actionController));

rasaActionRouter.post("/action/definir_nivel", ...isPermissions.isAuthenticated(), actionController.definirNivel.bind(actionController));

rasaActionRouter.get("/action/listar_opcoes", ...isPermissions.isAuthenticated(), actionController.listarOpcoes.bind(actionController));

rasaActionRouter.post("/action/listar_subopcoes", ...isPermissions.isAuthenticated(), actionController.listarSubopcoes.bind(actionController));

rasaActionRouter.post("/action/gerar_perguntas", ...isPermissions.isAuthenticated(), actionController.gerarPerguntas.bind(actionController));

export { rasaActionRouter };
