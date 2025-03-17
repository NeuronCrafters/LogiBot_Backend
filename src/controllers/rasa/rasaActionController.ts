import { Request, Response } from "express";
import { RasaActionService } from "../../services/rasa/rasaActionService";
import { AppError } from "../../exceptions/AppError";

class RasaActionController {
  private rasaActionService: RasaActionService;

  constructor() {
    this.rasaActionService = new RasaActionService();
  }

  async iniciarBot(req: Request, res: Response) {
    try {
      const response = await this.rasaActionService.iniciarBot();
      return res.json(response);
    } catch (error) {
      return res.status(500).json({ error: "erro ao iniciar o bot" });
    }
  }

  async listarNiveis(req: Request, res: Response) {
    try {
      const response = await this.rasaActionService.listarNiveis();
      return res.json(response);
    } catch (error) {
      return res.status(500).json({ error: "erro ao listar níveis" });
    }
  }

  async definirNivel(req: Request, res: Response) {
    try {
      const { nivel } = req.body;
      if (!nivel) {
        throw new AppError("o campo 'nivel' é obrigatório", 400);
      }
      const response = await this.rasaActionService.definirNivel(nivel);
      return res.json(response);
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || "erro ao definir o nível" });
    }
  }

  async listarSubopcoes(req: Request, res: Response) {
    try {
      const { categoria } = req.body;
      if (!categoria) {
        throw new AppError("categoria é obrigatória", 400);
      }

      const response = await this.rasaActionService.listarSubopcoes(categoria);
      return res.json(response);
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || "erro ao listar subopções" });
    }
  }

  async gerarPerguntas(req: Request, res: Response) {
    try {
      const { pergunta } = req.body;
      if (!pergunta) {
        return res.status(400).json({ error: "pergunta é obrigatória" });
      }

      console.log("✅ [CONTROLLER] Recebida pergunta:", pergunta);

      const response = await this.rasaActionService.gerarPerguntas(pergunta);

      console.log("✅ [CONTROLLER] Perguntas geradas:", response);

      return res.json({
        questions: response.questions,
        answer_keys: response.answer_keys
      });
    } catch (error) {
      console.error("❌ [CONTROLLER] Erro ao gerar perguntas:", error);
      return res.status(error.statusCode || 500).json({ error: error.message || "Erro ao gerar perguntas" });
    }
  }

}

export { RasaActionController };