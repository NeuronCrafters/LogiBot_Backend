import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { RasaActionController } from "../../controllers/rasa/rasaActionController";

const rasaActionRoute = Router();
const actionController = new RasaActionController();

// inicia a conversa e obtém os níveis disponíveis
rasaActionRoute.post("/action/iniciar", ...isPermissions.isAuthenticated(), (req, res) => {
  console.log("Acessando rota: /action/iniciar");
  actionController.iniciarBot(req, res);
});

// lista os níveis disponíveis
rasaActionRoute.get("/action/listar_niveis", ...isPermissions.isAuthenticated(), (req, res) => {
  console.log("Acessando rota: /action/listar_niveis");
  actionController.listarNiveis(req, res);
});

// define o nível do usuário
rasaActionRoute.post("/action/definir_nivel", ...isPermissions.isAuthenticated(), (req, res) => {
  console.log("Acessando rota: /action/definir_nivel");
  console.log("Body recebido:", req.body);
  actionController.definirNivel(req, res);
});

// lista as opções disponíveis
rasaActionRoute.get("/action/listar_opcoes", ...isPermissions.isAuthenticated(), (req, res) => {
  console.log("Acessando rota: /action/listar_opcoes");
  actionController.listarOpcoes(req, res);
});

// lista as subopções de uma categoria específica
rasaActionRoute.post("/action/listar_subopcoes", ...isPermissions.isAuthenticated(), (req, res) => {
  console.log("Acessando rota: /action/listar_subopcoes");
  console.log("Body recebido:", req.body);
  actionController.listarSubopcoes(req, res);
});

// gera perguntas com base em uma subopção escolhida
rasaActionRoute.post("/action/gerar_perguntas", ...isPermissions.isAuthenticated(), (req, res) => {
  console.log("Acessando rota: /action/gerar_perguntas");
  console.log("Body recebido:", req.body);
  actionController.gerarPerguntas(req, res);
});

export { rasaActionRoute };
