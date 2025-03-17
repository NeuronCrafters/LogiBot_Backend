import { AppError } from "../../exceptions/AppError";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

class RasaActionService {
  private nivelAtual: string | null = null;
  private lastAnswerKeys: string[] = [];
  private lastSubject: string | null = null;

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
          sender_id: "user"
        },
      });
      return response.data;
    } catch (error) {
      throw new AppError("Erro ao obter as opções", 500);
    }
  }

  async sendOpcaoEListarSubopcoes(categoria: string) {
    try {
      this.lastSubject = categoria;
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

    return { questions };
  }

  async gerarPerguntas(pergunta: string) {
    if (!this.nivelAtual) {
      throw new AppError("O nível do usuário precisa ser definido antes de gerar perguntas.", 400);
    }

    try {
      this.lastSubject = pergunta;
      const response = await axios.post(RASA_ACTION_URL, {
        next_action: "action_gerar_perguntas_chatgpt",
        tracker: {
          sender_id: "user",
          slots: { pergunta, nivel: this.nivelAtual },
        },
      });


      if (!response.data || !response.data.responses || response.data.responses.length === 0) {
        throw new AppError("Resposta do Rasa não contém texto válido.", 500);
      }

      const rawText = response.data.responses[0]?.text;
      this.lastAnswerKeys = response.data.responses[0]?.custom?.answer_keys || [];

      if (!rawText) {
        throw new AppError("Resposta do Rasa não contém texto.", 500);
      }

      const jsonData = this.parseQuestionsFromText(rawText);

      if (!jsonData.questions || !Array.isArray(jsonData.questions)) {
        throw new AppError("Formato inesperado de perguntas na resposta.", 500);
      }

      return { questions: jsonData.questions };
    } catch (error) {
      throw new AppError("Erro ao gerar perguntas", 500);
    }
  }

  async getGabarito() {
    return { answer_keys: this.lastAnswerKeys, assunto: this.lastSubject };
  }

  async verificarRespostas(respostas: string[]) {
    if (!this.lastAnswerKeys.length) {
      throw new AppError("Nenhum gabarito disponível. Gere perguntas primeiro.", 400);
    }

    if (!Array.isArray(respostas) || respostas.length !== this.lastAnswerKeys.length) {
      throw new AppError("Número de respostas inválido.", 400);
    }

    let acertos = 0;
    let erros = 0;
    let resultados = [];

    respostas.forEach((resposta, index) => {
      if (resposta === this.lastAnswerKeys[index]) {
        acertos++;
        resultados.push({ pergunta: index + 1, status: "✅ Correta! 🎉", resposta });
      } else {
        erros++;
        resultados.push({ pergunta: index + 1, status: "❌ Errada! 😢", resposta, correta: this.lastAnswerKeys[index] });
      }
    });

    return {
      message: acertos === this.lastAnswerKeys.length ? "🎉 Parabéns! Você acertou todas as questões!" : "⚠️ Aqui está seu resultado:",
      total_acertos: acertos,
      total_erros: erros,
      total_questoes: this.lastAnswerKeys.length,
      assunto: this.lastSubject,
      detalhes: resultados
    };
  }
}

export { RasaActionService };
