import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { RasaActionController } from "../../controllers/rasa/rasaActionController";

const rasaActionRoute = Router();
const actionController = new RasaActionController();

console.log("[RasaActionRoutes] registrando rotas do Rasa...");


// inicia a conversa e obtém níveis disponíveis
rasaActionRoute.post("/action/iniciar", isPermissions.isAuthenticated(), (req, res) => {
  console.log("[RasaActionRoutes] acessando rota: /saelaction/action/iniciar");
  actionController.iniciarBot(req, res);
});

// lista os níveis disponíveis
rasaActionRoute.get("/action/listar_niveis", isPermissions.isAuthenticated(), (req, res) => {
  console.log("[RasaActionRoutes] acessando rota: /saelaction/action/listar_niveis");
  actionController.listarNiveis(req, res);
});

// define o nível do usuário no Rasa
rasaActionRoute.post("/action/definir_nivel", isPermissions.isAuthenticated(), (req, res) => {
  console.log("[RasaActionRoutes] acessando rota: /saelaction/action/definir_nivel");
  console.log("[RasaActionRoutes] body recebido:", req.body);
  actionController.definirNivel(req, res);
});


// lista as subopções de uma categoria específica
rasaActionRoute.post("/action/listar_subopcoes", isPermissions.isAuthenticated(), async (req, res) => {
  console.log("📌 [RasaActionRoutes] acessando rota: /saelaction/action/listar_subopcoes");
  console.log("📥 [RasaActionRoutes] body recebido:", req.body);

  try {
    const { categoria } = req.body;
    if (!categoria) {
      return res.status(400).json({ error: "categoria é obrigatória" });
    }

    await actionController.listarSubopcoes(req, res);
  } catch (error) {
    console.error("❌ [RasaActionRoutes] erro ao listar subopções:", error);
    return res.status(500).json({ error: "erro ao listar subopções" });
  }
});

// adicionando rota para gerar perguntas a partir da subopção escolhida
rasaActionRoute.post("/action/gerar_perguntas", isPermissions.isAuthenticated(), async (req, res) => {
  console.log("📌 [RasaActionRoutes] acessando rota: /saelaction/action/gerar_perguntas");
  console.log("📥 [RasaActionRoutes] body recebido:", req.body);

  try {
    const { pergunta } = req.body;
    if (!pergunta) {
      return res.status(400).json({ error: "pergunta é obrigatória" });
    }

    const response = await actionController.gerarPerguntas(req, res);
    return res.json(response);
  } catch (error) {
    console.error("❌ [RasaActionRoutes] erro ao gerar perguntas:", error);
    return res.status(500).json({ error: "erro ao gerar perguntas" });
  }
});


export { rasaActionRoute };
