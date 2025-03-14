import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { RasaSendController } from "../../controllers/rasa/rasaControllerSend";
import { RasaGetLogsController } from "../../controllers/rasa/rasaGetLogsController";

const rasaRouter = Router();

const sendController = new RasaSendController();
const logsController = new RasaGetLogsController();

//---ROTA PARA O RASA ---

// Rota para enviar mensagem ao chatbot (somente usuários autenticados)
rasaRouter.post("/talk", ...isPermissions.isAuthenticated(), sendController.handle.bind(sendController));

//---ROTAS DE LOGS---

// Rota para Admin: acesso total a todos os logs
rasaRouter.get("/logs/admin", ...isPermissions.isAdmin(), logsController.handle.bind(logsController));

// Rota para Coordenador: acesso apenas aos logs dos cursos e disciplinas que ele coordena
rasaRouter.get("/logs/coordinator", ...isPermissions.isAdminOrCoordinator(), logsController.handle.bind(logsController));

// Rota para Professores: acesso apenas aos logs dos alunos das disciplinas que ele ensina
rasaRouter.get("/logs/professor", ...isPermissions.isAdminProfessorOrCoordinator(), logsController.handle.bind(logsController));


export { rasaRouter };
