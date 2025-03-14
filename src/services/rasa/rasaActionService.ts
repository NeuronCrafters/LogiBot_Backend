import { AppError } from "../../exceptions/AppError";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

class RasaActionService {
  // inicia o bot e lista os níveis disponíveis
  async iniciarBot() {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_niveis",
      });
      return response.data;
    } catch (error) {
      console.error("[RasaActionService] Erro ao iniciar o bot:", error);
      throw new AppError("Erro ao iniciar a conversa com o bot.", 500);
    }
  }

  // obtém os níveis disponíveis no Rasa
  async listarNiveis() {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_niveis",
      });
      return response.data;
    } catch (error) {
      console.error("[RasaActionService] Erro ao listar níveis:", error);
      throw new AppError("Erro ao obter os níveis.", 500);
    }
  }

  // define o nível do usuário no Rasa
  async definirNivel(nivel: string) {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_definir_nivel",
        tracker: { slots: { nivel } },
      });
      return response.data;
    } catch (error) {
      console.error("[RasaActionService] Erro ao definir nível:", error);
      throw new AppError("Erro ao definir o nível.", 500);
    }
  }

  // obtém as opções disponíveis no Rasa
  async listarOpcoes() {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_opcoes",
      });
      return response.data;
    } catch (error) {
      console.error("[RasaActionService] Erro ao listar opções:", error);
      throw new AppError("Erro ao obter as opções.", 500);
    }
  }

  // obtém as subopções de um determinado assunto
  async listarSubopcoes(categoria: string) {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_subopcoes",
        tracker: { slots: { categoria } },
      });
      return response.data;
    } catch (error) {
      console.error("[RasaActionService] Erro ao listar subopções:", error);
      throw new AppError("Erro ao obter as subopções.", 500);
    }
  }

  // gera perguntas sobre um subtópico específico
  async gerarPerguntas(subtopico: string, nivel: string) {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_gerar_perguntas_chatgpt",
        tracker: { slots: { pergunta: subtopico, nivel } },
      });
      return response.data;
    } catch (error) {
      console.error("[RasaActionService] Erro ao gerar perguntas:", error);
      throw new AppError("Erro ao gerar perguntas.", 500);
    }
  }
}

export { RasaActionService };
