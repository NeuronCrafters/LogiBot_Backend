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
      throw new AppError("Erro ao iniciar a conversa com o bot", 500);
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
      throw new AppError("Erro ao obter os níveis", 500);
    }
  }

  async definirNivel(nivel: string) {
    try {
      const nivelResponse = await axios.post(RASA_ACTION_URL, {
        next_action: "action_definir_nivel",
        tracker: {
          sender_id: "user",
          slots: { nivel },
        },
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
          sender_id: "user",
        },
      });

      return response.data;
    } catch (error) {
      throw new AppError("Erro ao obter as opções", 500);
    }
  }

  async listarSubopcoes(categoria: string) {
    try {
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_listar_subopcoes",
        tracker: {
          sender_id: "user",
          slots: { categoria },
        },
      });

      return response.data;
    } catch (error) {
      throw new AppError("Erro ao obter as subopções", 500);
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

  private parseQuestionsFromText(text: string) {
    const lines = text.split("\n");
    const questions = [];
    let currentQuestion = null;

    for (const line of lines) {
      const questionMatch = line.match(/^\d+\)\s*(.*)/);
      if (questionMatch) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        currentQuestion = {
          question: questionMatch[1].trim(),
          options: [],
        };
      }

      else if (line.trim().startsWith("- (")) {
        if (currentQuestion) {
          currentQuestion.options.push(line.trim().substring(3));
        }
      }
    }

    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    const answerKeys = ["Opção A", "Opção B", "Opção C", "Opção D", "Opção E"];

    return {
      questions,
      answer_keys: answerKeys,
    };
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
          slots: { pergunta, nivel: this.nivelAtual },
        },
      });

      const rawText = response.data.responses[0]?.text;
      if (!rawText) {
        throw new AppError("Resposta do Rasa não contém texto.", 500);
      }

      const jsonData = this.parseQuestionsFromText(rawText);

      if (!jsonData.questions || !Array.isArray(jsonData.questions)) {
        throw new AppError("Formato inesperado de perguntas na resposta.", 500);
      }

      const resultado = {
        questions: jsonData.questions.map((q: any) => ({
          pergunta: q.question || "Pergunta não encontrada",
          opcoes: q.options || [],
        })),
        answer_keys: jsonData.answer_keys,
      };

      return resultado;
    } catch (error) {
      throw new AppError("Erro ao gerar perguntas", 500);
    }
  }
}

export { RasaActionService };