import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { RasaSendController } from "../../controllers/rasa/rasaControllerSend";
import { RasaGetLogsController } from "../../controllers/rasa/rasaGetLogsController";
import { RasaActionController } from "../../controllers/rasa/rasaActionController";

const rasaRouter = Router();

const sendController = new RasaSendController();
const logsController = new RasaGetLogsController();
const actionController = new RasaActionController();

// rota para enviar mensagem ao chatbot (somente usuários autenticados)
rasaRouter.post("/talk", ...isPermissions.isAuthenticated(), sendController.handle.bind(sendController));

// rota para Admin: acesso total a todos os logs
rasaRouter.get("/logs/admin", ...isPermissions.isAdmin(), logsController.handle.bind(logsController));

//rota para Coordenador: acesso apenas aos logs dos cursos e disciplinas que ele coordena
rasaRouter.get("/logs/coordinator", ...isPermissions.isAdminOrCoordinator(), logsController.handle.bind(logsController));

// rota para Professores: acesso apenas aos logs dos alunos das disciplinas que ele ensina
rasaRouter.get("/logs/professor", ...isPermissions.isAdminProfessorOrCoordinator(), logsController.handle.bind(logsController));

//iniciar o rasa action
rasaRouter.post("/action/iniciar", ...isPermissions.isAuthenticated(), actionController.iniciarConversa.bind(actionController));

// listar níveis
rasaRouter.get("/action/listar_niveis", ...isPermissions.isAuthenticated(), actionController.listarNiveis.bind(actionController));

// definir nível do usuário no Rasa
rasaRouter.post("/action/definir_nivel", ...isPermissions.isAuthenticated(), actionController.definirNivel.bind(actionController));

// listar opções disponíveis no Rasa
rasaRouter.get("/action/listar_opcoes", ...isPermissions.isAuthenticated(), actionController.listarOpcoes.bind(actionController));

// listar subopcoes
rasaRouter.post("/action/listar_subopcoes", ...isPermissions.isAuthenticated(), actionController.listarSubopcoes.bind(actionController));

export { rasaRouter };
