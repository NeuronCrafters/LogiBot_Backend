import { AppError } from "../../exceptions/AppError";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

class RasaActionService {
  private nivelAtual: string | null = null;

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
    console.log("[RasaActionService] listando níveis disponíveis...");
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
        tracker: {
          sender_id: "user",
          slots: { nivel }
        }
      });

      this.nivelAtual = nivel;

      return nivelResponse.data;
    } catch (error) {

      throw new AppError("Erro ao definir o nível.", 500);
    }
  }

  async listarOpcoes() {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_opcoes",
        tracker: {
          sender_id: "user"
        }
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
        tracker: {
          sender_id: "user",
          slots: { categoria }
        }
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

  async gerarPerguntas(pergunta: string) {
    if (!this.nivelAtual) {
      throw new AppError("O nível do usuário precisa ser definido antes de gerar perguntas.", 400);
    }

    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_gerar_perguntas_chatgpt",
        tracker: {
          sender_id: "user",
          slots: { pergunta, nivel: this.nivelAtual }
        }
      });

      console.log("✅ [SERVICE] Resposta do Rasa:", response.data);

      if (!response.data.responses || !response.data.responses[0]?.text) {
        throw new AppError("Formato de resposta inválido do Rasa.", 500);
      }

      const rawText = response.data.responses[0].text;
      let jsonData;

      try {
        jsonData = JSON.parse(rawText);
      } catch (error) {
        console.warn("⚠️ [SERVICE] Resposta não está no formato JSON válido.");
        throw new AppError("Erro ao interpretar a resposta do Rasa.", 500);
      }

      if (!jsonData.questions || !Array.isArray(jsonData.questions) || !jsonData.answer_keys) {
        throw new AppError("Formato inesperado de perguntas na resposta.", 500);
      }

      const resultado = {
        questions: jsonData.questions.map((q: any) => ({
          pergunta: q.question || "Pergunta não encontrada",
          opcoes: q.options || []
        })),
        answer_keys: jsonData.answer_keys.map((resposta: string) => resposta)
      };

      console.log("✅ [SERVICE] Perguntas extraídas:", resultado);
      return resultado;
    } catch (error) {
      console.error("❌ [SERVICE] Erro ao gerar perguntas:", error);
      throw new AppError("Erro ao gerar perguntas", 500);
    }
  }
}

export { RasaActionService };