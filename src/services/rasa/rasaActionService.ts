import { AppError } from "../../exceptions/AppError";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

class RasaActionService {
  // inicia a conversa e obtém os níveis disponíveis
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

  // obtém os níveis disponíveis no Rasa
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

  // define o nível do usuário no Rasa
  async definirNivel(nivel: string) {
    try {
      console.log("🚀 [SERVICE] Enviando requisição para definir nível...");
      console.log("📥 [SERVICE] Nível enviado:", nivel);

      // Define o nível no Rasa
      const nivelResponse = await axios.post(RASA_ACTION_URL, {
        next_action: "action_definir_nivel",
        tracker: {
          sender_id: "user",
          slots: { nivel }
        }
      });

      console.log("✅ [SERVICE] Nível definido com sucesso:", nivelResponse.data);

      // Espera um curto tempo antes de buscar opções para garantir que o Rasa processe o novo nível
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Obtém as opções disponíveis após definir o nível
      console.log("📌 [SERVICE] Buscando opções disponíveis...");
      const opcoesResponse = await this.listarOpcoes();

      const response = {
        nivel_definido: nivelResponse.data,
        opcoes_disponiveis: opcoesResponse
      };

      console.log("🎯 [SERVICE] Resposta final:", response);
      return response;
    } catch (error) {
      console.error("❌ [SERVICE] Erro ao definir nível e listar opções:", error);
      throw new AppError("Erro ao definir o nível e obter as opções.", 500);
    }
  }

  // obtém as opções disponíveis no Rasa
  async listarOpcoes() {
    console.log("📌 [SERVICE] Buscando opções disponíveis...");
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_opcoes",
        tracker: {
          sender_id: "user" // 🔥 Corrigindo para enviar um sender_id
        }
      });

      console.log("✅ [SERVICE] Opções recebidas:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ [SERVICE] Erro ao listar opções:", error);
      throw new AppError("erro ao obter as opções", 500);
    }
  }

  // obtém as subopções de uma categoria específica
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

  // gera perguntas com base em um subtópico específico
  async gerarPerguntas(pergunta: string, nivel: string) {
    console.log(`📌 [SERVICE] Enviando pergunta para o Rasa: ${pergunta} (nível: ${nivel})`);

    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_gerar_perguntas_chatgpt",
        tracker: {
          sender_id: "user",
          slots: { pergunta, nivel }
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
