import { Request, Response } from "express";
import { RasaActionService } from "../../services/rasa/rasaActionService";
import { AppError } from "../../exceptions/AppError";

class RasaActionController {
  private rasaActionService: RasaActionService;

  constructor() {
    this.rasaActionService = new RasaActionService();
  }

  // inicia o bot e obtém os níveis disponíveis
  async iniciarBot(req: Request, res: Response) {
    console.log("[RasaActionController] iniciando o bot...");
    try {
      const response = await this.rasaActionService.iniciarBot();
      console.log("[RasaActionController] resposta do Rasa:", response);
      return res.json(response);
    } catch (error) {
      console.error("[RasaActionController] erro ao iniciar o bot:", error);
      return res.status(500).json({ error: "erro ao iniciar o bot" });
    }
  }

  // lista os níveis disponíveis
  async listarNiveis(req: Request, res: Response) {
    console.log("[RasaActionController] listando níveis...");
    try {
      const response = await this.rasaActionService.listarNiveis();
      console.log("[RasaActionController] resposta do Rasa:", response);
      return res.json(response);
    } catch (error) {
      console.error("[RasaActionController] erro ao listar níveis:", error);
      return res.status(500).json({ error: "erro ao listar níveis" });
    }
  }

  // define o nível do usuário no Rasa
  async definirNivel(req: Request, res: Response) {
    console.log("[RasaActionController] definindo nível...");
    console.log("body recebido:", req.body);
    try {
      const { nivel } = req.body;
      if (!nivel) {
        throw new AppError("o campo 'nivel' é obrigatório", 400);
      }
      const response = await this.rasaActionService.definirNivel(nivel);
      console.log("[RasaActionController] resposta do Rasa:", response);
      return res.json(response);
    } catch (error) {
      console.error("[RasaActionController] erro ao definir nível:", error);
      return res.status(error.statusCode || 500).json({ error: error.message || "erro ao definir o nível" });
    }
  }

  async listarSubopcoes(req: Request, res: Response) {
    console.log("📌 [RasaActionController] listando subopções...");
    console.log("📥 [RasaActionController] body recebido:", req.body);

    try {
      const { categoria } = req.body;
      if (!categoria) {
        throw new AppError("categoria é obrigatória", 400);
      }

      const response = await this.rasaActionService.listarSubopcoes(categoria);
      return res.json(response);
    } catch (error) {
      console.error("❌ [RasaActionController] erro ao listar subopções:", error);
      return res.status(error.statusCode || 500).json({ error: error.message || "erro ao listar subopções" });
    }
  }

  async gerarPerguntas(req: Request, res: Response) {
    console.log("📌 [RasaActionController] gerando perguntas...");
    console.log("📥 [RasaActionController] body recebido:", req.body);

    try {
      const { pergunta } = req.body;
      if (!pergunta) {
        throw new AppError("pergunta é obrigatória", 400);
      }

      const response = await this.rasaActionService.gerarPerguntas(pergunta);
      return res.json(response);
    } catch (error) {
      console.error("❌ [RasaActionController] erro ao gerar perguntas:", error);
      return res.status(error.statusCode || 500).json({ error: error.message || "erro ao gerar perguntas" });
    }
  }
}



export { RasaActionController };
