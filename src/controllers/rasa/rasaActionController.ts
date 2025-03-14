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
    try {
      const response = await this.rasaActionService.iniciarBot();
      return res.json(response);
    } catch (error) {
      console.error("[RasaActionController] erro ao iniciar o bot:", error);
      return res.status(500).json({ error: "erro ao iniciar o bot" });
    }
  }

  // lista os níveis disponíveis
  async listarNiveis(req: Request, res: Response) {
    try {
      const response = await this.rasaActionService.listarNiveis();
      return res.json(response);
    } catch (error) {
      console.error("[RasaActionController] erro ao listar níveis:", error);
      return res.status(500).json({ error: "erro ao listar níveis" });
    }
  }

  // define o nível do usuário
  async definirNivel(req: Request, res: Response) {
    try {
      const { nivel } = req.body;
      if (!nivel) {
        throw new AppError("o campo 'nivel' é obrigatório", 400);
      }

      const response = await this.rasaActionService.definirNivel(nivel);
      return res.json(response);
    } catch (error) {
      console.error("[RasaActionController] erro ao definir nível:", error);
      return res.status(error.statusCode || 500).json({ error: error.message || "erro ao definir nível" });
    }
  }

  // lista as opções disponíveis
  async listarOpcoes(req: Request, res: Response) {
    try {
      const response = await this.rasaActionService.listarOpcoes();
      return res.json(response);
    } catch (error) {
      console.error("[RasaActionController] erro ao listar opções:", error);
      return res.status(500).json({ error: "erro ao listar opções" });
    }
  }

  // lista as subopções de uma categoria específica
  async listarSubopcoes(req: Request, res: Response) {
    try {
      const { categoria } = req.body;
      if (!categoria) {
        throw new AppError("o campo 'categoria' é obrigatório", 400);
      }

      const response = await this.rasaActionService.listarSubopcoes(categoria);
      return res.json(response);
    } catch (error) {
      console.error("[RasaActionController] erro ao listar subopções:", error);
      return res.status(error.statusCode || 500).json({ error: error.message || "erro ao listar subopções" });
    }
  }

  // gera perguntas com base em uma subopção escolhida
  async gerarPerguntas(req: Request, res: Response) {
    try {
      const { subtopico, nivel } = req.body;
      if (!subtopico || !nivel) {
        throw new AppError("os campos 'subtopico' e 'nivel' são obrigatórios", 400);
      }

      const response = await this.rasaActionService.gerarPerguntas(subtopico, nivel);
      return res.json(response);
    } catch (error) {
      console.error("[RasaActionController] erro ao gerar perguntas:", error);
      return res.status(error.statusCode || 500).json({ error: error.message || "erro ao gerar perguntas" });
    }
  }
}

export { RasaActionController };
