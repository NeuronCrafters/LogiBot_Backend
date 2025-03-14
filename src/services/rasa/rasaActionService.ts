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


