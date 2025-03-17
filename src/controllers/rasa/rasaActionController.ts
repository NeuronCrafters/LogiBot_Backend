import { Request, Response } from "express";
import { RasaActionService } from "../../services/rasa/rasaActionService";

class RasaActionController {
  private rasaActionService: RasaActionService;

  constructor() {
    this.rasaActionService = new RasaActionService();
  }

  async listarNiveis(req: Request, res: Response) {
    try {
      const niveis = await this.rasaActionService.listarNiveis();
      return res.status(200).json(niveis);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao obter os níveis", error: error.message });
    }
  }

  async definirNivel(req: Request, res: Response) {
    try {
      const { nivel } = req.body;
      const result = await this.rasaActionService.definirNivel(nivel);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao definir o nível", error: error.message });
    }
  }

  async listarOpcoes(req: Request, res: Response) {
    try {
      const opcoes = await this.rasaActionService.listarOpcoes();
      return res.status(200).json(opcoes);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao obter as opções", error: error.message });
    }
  }

  async sendOpcaoEListarSubopcoes(req: Request, res: Response) {
    try {
      const { categoria } = req.body;
      const subopcoes = await this.rasaActionService.sendOpcaoEListarSubopcoes(categoria);
      return res.status(200).json(subopcoes);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao obter as subopções", error: error.message });
    }
  }

  async gerarPerguntas(req: Request, res: Response) {
    try {
      const { pergunta } = req.body;
      const perguntas = await this.rasaActionService.gerarPerguntas(pergunta);
      return res.status(200).json(perguntas);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao gerar perguntas", error: error.message });
    }
  }

  async getGabarito(req: Request, res: Response) {
    try {
      const gabarito = await this.rasaActionService.getGabarito();
      return res.status(200).json(gabarito);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao obter o gabarito", error: error.message });
    }
  }

  async verificarRespostas(req: Request, res: Response) {
    try {
      const { respostas } = req.body;
      const resultado = await this.rasaActionService.verificarRespostas(respostas);
      return res.status(200).json(resultado);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao verificar respostas", error: error.message });
    }
  }
}

export { RasaActionController };
