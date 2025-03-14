import { Request, Response } from "express";
import { AppError } from "../../exceptions/AppError";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

class RasaActionService {
  async iniciarBot() {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_niveis",
      });
      return response.data;
    } catch (error) {
      throw new AppError("erro ao iniciar a conversa com o bot", 500);
    }
  }

  async listarNiveis() {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_niveis",
        tracker: { sender_id: "user" },
      });
      return response.data;
    } catch (error) {
      throw new AppError("erro ao obter os níveis", 500);
    }
  }

  async definirNivel(nivel: string) {
    try {
      const nivelResponse = await axios.post(RASA_ACTION_URL, {
        next_action: "action_definir_nivel",
        tracker: { sender_id: "user", slots: { nivel } }
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      const opcoesResponse = await this.listarOpcoes();
      return { nivel_definido: nivelResponse.data, opcoes_disponiveis: opcoesResponse };
    } catch (error) {
      throw new AppError("Erro ao definir o nível e obter as opções.", 500);
    }
  }

  async listarOpcoes() {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_opcoes",
        tracker: { sender_id: "user" }
      });
      return response.data;
    } catch (error) {
      throw new AppError("erro ao obter as opções", 500);
    }
  }

  async listarSubopcoes(categoria: string) {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_subopcoes",
        tracker: { sender_id: "user", slots: { categoria } }
      });
      return response.data;
    } catch (error) {
      throw new AppError("erro ao obter as subopções", 500);
    }
  }

  async obterNivelAtual(): Promise<string | null> {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_obter_nivel",
        tracker: { sender_id: "user" },
      });
      if (!response.data || !response.data.nivel) {
        return null;
      }
      return response.data.nivel;
    } catch (error) {
      return null;
    }
  }

  async gerarPerguntas(pergunta: string, nivel: string) {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_gerar_perguntas_chatgpt",
        tracker: { sender_id: "user", slots: { pergunta, nivel } }
      });
      return response.data;
    } catch (error) {
      throw new AppError("erro ao gerar perguntas", 500);
    }
  }
}

export { RasaActionService };

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
      const nivel = await this.rasaActionService.obterNivelAtual();
      if (!nivel) {
        return res.status(500).json({ error: "Não foi possível obter o nível do usuário." });
      }
      const response = await this.rasaActionService.gerarPerguntas(pergunta, nivel);
      return res.json(response);
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || "erro ao gerar perguntas" });
    }
  }
}

export { RasaActionController };
