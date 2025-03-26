import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { RasaSendController } from "../../controllers/rasa/rasaSendController";
import { listarNiveisController } from "../../controllers/rasa/ActionController/listarNiveisController";
import { definirNivelController } from "../../controllers/rasa/ActionController/definirNivelController";
import { listarOpcoesController } from "../../controllers/rasa/ActionController/listarOpcoesController";
import { sendOpcaoEListarSubopcoesController } from "../../controllers/rasa/ActionController/sendOpcaoEListarSubopcoesController";
import { gerarPerguntasController } from "../../controllers/rasa/ActionController/gerarPerguntasController";
import { getGabaritoController } from "../../controllers/rasa/ActionController/getGabaritoController";
import { verificarRespostasController } from "../../controllers/rasa/ActionController/verificarRespostasController";

const rasaRouter = Router();
const sendController = new RasaSendController();

// Rota para enviar mensagem ao chatbot (ainda em classe)
rasaRouter.post("/talk", ...isPermissions.isAuthenticated(), sendController.handle.bind(sendController));

// Rota: Listar níveis
rasaRouter.get("/action/listar_niveis", ...isPermissions.isAuthenticated(), listarNiveisController);

// Rota: Definir nível
rasaRouter.post("/action/definir_nivel", ...isPermissions.isAuthenticated(), definirNivelController);

// Rota: Listar opções
rasaRouter.get("/action/listar_opcoes", ...isPermissions.isAuthenticated(), listarOpcoesController);

// Rota: Listar subopções
rasaRouter.post("/action/listar_subopcoes", ...isPermissions.isAuthenticated(), sendOpcaoEListarSubopcoesController);

// Rota: Gerar perguntas
rasaRouter.post("/action/gerar_perguntas", ...isPermissions.isAuthenticated(), gerarPerguntasController);

// Rota: Obter gabarito
rasaRouter.get("/action/gabarito", ...isPermissions.isAdminProfessorOrCoordinator(), getGabaritoController);

// Rota: Verificar respostas
rasaRouter.post("/action/send", ...isPermissions.isAuthenticated(), verificarRespostasController);

export { rasaRouter };
