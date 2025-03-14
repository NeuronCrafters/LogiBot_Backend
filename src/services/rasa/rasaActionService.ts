import { AppError } from "../../exceptions/AppError";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

class RasaActionService {
  private nivelAtual: string | null = null;

  async iniciarBot() {
    console.log("[RasaActionService] iniciando o bot e listando níveis...");
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_niveis",
      });
      console.log("[RasaActionService] resposta do Rasa:", response.data);
      return response.data;
    } catch (error) {
      console.error("[RasaActionService] erro ao iniciar o bot:", error);
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
      console.log("[RasaActionService] resposta do Rasa:", response.data);
      return response.data;
    } catch (error) {
      console.error("[RasaActionService] erro ao listar níveis:", error);
      throw new AppError("erro ao obter os níveis", 500);
    }
  }

  async definirNivel(nivel: string) {
    try {
      console.log("🚀 [SERVICE] Enviando requisição para definir nível...");
      console.log("📥 [SERVICE] Nível enviado:", nivel);

      const nivelResponse = await axios.post(RASA_ACTION_URL, {
        next_action: "action_definir_nivel",
        tracker: {
          sender_id: "user",
          slots: { nivel }
        }
      });

      console.log("✅ [SERVICE] Nível definido com sucesso:", nivelResponse.data);

      this.nivelAtual = nivel;

      return nivelResponse.data;
    } catch (error) {
      console.error("❌ [SERVICE] Erro ao definir nível:", error);
      throw new AppError("Erro ao definir o nível.", 500);
    }
  }

  async listarOpcoes() {
    console.log("📌 [SERVICE] Buscando opções disponíveis...");
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_opcoes",
        tracker: {
          sender_id: "user"
        }
      });

      console.log("✅ [SERVICE] Opções recebidas:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ [SERVICE] Erro ao listar opções:", error);
      throw new AppError("erro ao obter as opções", 500);
    }
  }

  async listarSubopcoes(categoria: string) {
    console.log(`📌 [SERVICE] Buscando subopções para a categoria: ${categoria}`);
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_subopcoes",
        tracker: {
          sender_id: "user",
          slots: { categoria }
        }
      });

      console.log("✅ [SERVICE] Subopções recebidas:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ [SERVICE] Erro ao listar subopções:", error);
      throw new AppError("erro ao obter as subopções", 500);
    }
  }

  async obterNivelAtual(): Promise<string | null> {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_obter_nivel",
        tracker: { sender_id: "user" },
      });

      console.log("✅ [SERVICE] Resposta do Rasa ao obter nível:", response.data);

      if (!response.data || !response.data.nivel) {
        console.warn("⚠️ [SERVICE] O Rasa não retornou um nível válido.");
        return null;
      }

      return response.data.nivel;
    } catch (error) {
      console.error("❌ [SERVICE] Erro ao obter nível do usuário:", error);
      return null;
    }
  }


  async gerarPerguntas(pergunta: string) {
    if (!this.nivelAtual) {
      console.warn("⚠️ [SERVICE] O nível do usuário não foi definido anteriormente.");
      throw new AppError("O nível do usuário precisa ser definido antes de gerar perguntas.", 400);
    }

    console.log(`📌 [SERVICE] Enviando pergunta para o Rasa: ${pergunta} (nível: ${this.nivelAtual})`);

    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_gerar_perguntas_chatgpt",
        tracker: {
          sender_id: "user",
          slots: { pergunta, nivel: this.nivelAtual }
        }
      });

      console.log("✅ [SERVICE] Resposta do Rasa:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ [SERVICE] Erro ao gerar perguntas:", error);
      throw new AppError("erro ao gerar perguntas", 500);
    }
  }




}

export { RasaActionService };
