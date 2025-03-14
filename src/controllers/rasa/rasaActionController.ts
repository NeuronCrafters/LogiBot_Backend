import { Request, Response } from "express";
import { RasaActionService } from "../../services/rasa/rasaActionService";
import { AppError } from "../../exceptions/AppError";

class RasaActionController {
  private rasaActionService: RasaActionService;

  constructor() {
    this.rasaActionService = new RasaActionService();
  }

  // rota para listar níveis

  async listarNiveis(req: Request, res: Response) {
    try {
      const result = await this.rasaActionService.listarNiveis();
      return res.json(result);
    } catch (error) {
      console.error("[RasaActionController] Erro ao listar níveis:", error);
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  // rota para definir nível
  async definirNivel(req: Request, res: Response) {
    try {
      const { nivel } = req.body;
      if (!nivel) {
        throw new AppError("O campo 'nivel' é obrigatório.", 400);
      }

      const result = await this.rasaActionService.definirNivel(nivel);
      return res.json(result);
    } catch (error) {
      console.error("[RasaActionController] Erro ao definir nível:", error);
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  // rota para listar opções
  async listarOpcoes(req: Request, res: Response) {
    try {
      const result = await this.rasaActionService.listarOpcoes();
      return res.json(result);
    } catch (error) {
      console.error("[RasaActionController] Erro ao listar opções:", error);
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  // rota para listar subopções de uma categoria
  async listarSubopcoes(req: Request, res: Response) {
    try {
      const { categoria } = req.body;
      if (!categoria) {
        throw new AppError("O campo 'categoria' é obrigatório.", 400);
      }

      const result = await this.rasaActionService.listarSubopcoes(categoria);
      return res.json(result);
    } catch (error) {
      console.error("[RasaActionController] Erro ao listar subopções:", error);
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export { RasaActionController };
