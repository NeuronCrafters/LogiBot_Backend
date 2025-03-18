import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

class RasaActionService {
  private nivelAtual: string | null = null;
  private lastAnswerKeys: string[] = [];
  private lastSubject: string | null = null;
  private lastQuestions: string[] = [];

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
    console.log("Chamando gerarPerguntas com pergunta:", pergunta);
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

      console.log("Resposta de gerarPerguntas:", response.data);

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

      this.lastQuestions = jsonData.questions.map(q => q.question);

      if (!this.lastQuestions.length) {
        console.error("Erro: Nenhuma pergunta extraída do Rasa.");
        throw new AppError("Nenhuma pergunta foi retornada pelo sistema.", 500);
      }

      console.log("Perguntas armazenadas corretamente:", this.lastQuestions);
      return { questions: jsonData.questions };
    } catch (error) {
      console.error("Erro ao gerar perguntas:", error);
      throw new AppError("Erro ao gerar perguntas", 500);
    }
  }

  async getGabarito() {
    console.log("Chamando getGabarito...");
    console.log("Gabarito retornado:", { answer_keys: this.lastAnswerKeys, assunto: this.lastSubject });

    return { answer_keys: this.lastAnswerKeys, assunto: this.lastSubject };

  }

  async verificarRespostas(respostas: string[], userId: string, email: string) {
    if (!this.lastAnswerKeys.length || !this.lastQuestions.length) {
      throw new AppError("Gabarito ou perguntas não definidos.", 400);
    }

    let acertos = 0;
    let erros = 0;

    const answerHistoryEntry = respostas.map((resposta, index) => {
      const isCorrect = resposta === this.lastAnswerKeys[index];
      isCorrect ? acertos++ : erros++;

      return {
        level: this.nivelAtual,
        subject: this.lastSubject,
        selectedOption: {
          question: this.lastQuestions[index],
          isCorrect: isCorrect.toString(),
          isSelected: resposta || "false",
        },
        totalCorrectAnswers: acertos,
        totalWrongAnswers: erros,
        timestamp: new Date(),
      };
    });

    answerHistoryEntry.forEach((entry, index) => {
      if (!entry.level) {
        console.log(`Entry ${index}: Missing field 'level'`);
      }
      if (!entry.subject) {
        console.log(`Entry ${index}: Missing field 'subject'`);
      }
      if (!entry.selectedOption) {
        console.log(`Entry ${index}: Missing field 'selectedOption'`);
      } else {
        if (!entry.selectedOption.question) {
          console.log(`Entry ${index}: Missing field 'selectedOption.question'`);
        }
        if (!entry.selectedOption.isCorrect) {
          console.log(`Entry ${index}: Missing field 'selectedOption.isCorrect'`);
        }
        if (!entry.selectedOption.isSelected) {
          console.log(`Entry ${index}: Missing field 'selectedOption.isSelected'`);
        }
      }

      if (entry.totalCorrectAnswers === undefined || entry.totalCorrectAnswers === null) {
        console.log(`Entry ${index}: Missing field 'totalCorrectAnswers'`);
      }
      if (entry.totalWrongAnswers === undefined || entry.totalWrongAnswers === null) {
        console.log(`Entry ${index}: Missing field 'totalWrongAnswers'`);
      }
      if (!entry.timestamp) {
        console.log(`Entry ${index}: Missing field 'timestamp'`);
      }
    });

    const hasMissingFields = answerHistoryEntry.some(entry =>
      !entry.level ||
      !entry.subject ||
      !entry.selectedOption ||
      !entry.selectedOption.question ||
      !entry.selectedOption.isSelected ||
      !entry.selectedOption.isCorrect ||
      entry.totalCorrectAnswers === undefined ||
      entry.totalWrongAnswers === undefined ||
      !entry.timestamp
    );

    if (hasMissingFields) {
      throw new AppError("Campos obrigatórios faltando no answerHistory.", 400);
    }

    await UserAnalysis.findOneAndUpdate(
      { userId, email },
      {
        $push: { "sessions.0.answerHistory": { questions: answerHistoryEntry } },
        $inc: {
          totalCorrectAnswers: acertos,
          totalWrongAnswers: erros,
          "sessions.0.totalCorrectAnswers": acertos,
          "sessions.0.totalWrongAnswers": erros,
        },
      },
      { new: true, upsert: true }
    );

    return {
      message: acertos === respostas.length ? "🎉 Parabéns! Acertou todas!" : "⚠️ Confira seu resultado:",
      totalCorrectAnswers: acertos,
      totalWrongAnswers: erros,
      detalhes: { questions: answerHistoryEntry },
    };
  }

}

export { RasaActionService };