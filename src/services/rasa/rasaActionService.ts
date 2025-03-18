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
        console.error("Erro: Resposta do Rasa não contém texto válido.");
        throw new AppError("Resposta do Rasa não contém texto válido.", 500);
      }

      const rawText = response.data.responses[0]?.text;
      this.lastAnswerKeys = response.data.responses[0]?.custom?.answer_keys || [];

      if (!rawText) {
        throw new AppError("Resposta do Rasa não contém texto.", 500);
      }

      const jsonData = this.parseQuestionsFromText(rawText);
      this.lastQuestions = jsonData.questions.map(q => q.question); // Armazena corretamente as perguntas

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
    console.log("Recebendo requisição para verificar respostas...");
    console.log("Respostas recebidas:", respostas);
    console.log("Usuário:", { userId, email });
    console.log("Gabarito armazenado:", this.lastAnswerKeys);
    console.log("Perguntas armazenadas:", this.lastQuestions);
    console.log("Nível atual:", this.nivelAtual);
    console.log("Assunto atual:", this.lastSubject);

    if (!this.lastAnswerKeys.length) {
      console.error("Erro: Nenhum gabarito armazenado.");
      throw new AppError("Nenhum gabarito disponível. Gere perguntas primeiro.", 400);
    }

    if (!this.lastQuestions.length) {
      console.error("Erro: Nenhuma pergunta armazenada antes de verificar respostas.");
      throw new AppError("Nenhuma pergunta foi armazenada. Gere perguntas primeiro.", 400);
    }

    if (!Array.isArray(respostas) || respostas.length !== this.lastAnswerKeys.length) {
      console.error("Erro: Número de respostas inválido.", {
        respostasRecebidas: respostas.length,
        respostasEsperadas: this.lastAnswerKeys.length,
      });
      throw new AppError("Número de respostas inválido.", 400);
    }

    let acertos = 0;
    let erros = 0;

    const level = this.nivelAtual || "Nível Desconhecido";
    const subject = this.lastSubject || "Assunto Desconhecido";

    let answerHistoryEntry = {
      questions: [] as any[],
    };

    respostas.forEach((resposta, index) => {
      const isCorrect = resposta === this.lastAnswerKeys[index];
      if (isCorrect) acertos++;
      else erros++;

      answerHistoryEntry.questions.push({
        level: level,
        subject: subject,
        selectedOption: [
          {
            question: this.lastQuestions[index], // Certifica-se de pegar a pergunta correta
            isCorrect: this.lastAnswerKeys[index],
            isSelected: resposta,
          },
        ],
        totalCorrectAnswers: acertos,
        totalWrongAnswers: erros,
        timestamp: new Date(),
      });
    });

    console.log("Resumo da verificação de respostas:", {
      totalAcertos: acertos,
      totalErros: erros,
      detalhes: answerHistoryEntry,
    });

    try {
      await UserAnalysis.findOneAndUpdate(
        { userId, email },
        {
          $push: { "sessions.0.answerHistory": { questions: answerHistoryEntry.questions } },
          $inc: {
            totalCorrectAnswers: acertos,
            totalWrongAnswers: erros,
            "sessions.0.totalCorrectAnswers": acertos,
            "sessions.0.totalWrongAnswers": erros,
          },
        },
        { new: true, upsert: true }
      );
      console.log("Dados atualizados no banco de dados para usuário:", userId);
    } catch (dbError) {
      console.error("Erro ao atualizar o banco de dados:", dbError);
      throw new AppError("Erro ao salvar respostas no banco de dados.", 500);
    }

    return {
      message: acertos === this.lastAnswerKeys.length ? "🎉 Parabéns! Você acertou todas as questões!" : "⚠️ Aqui está seu resultado:",
      totalCorrectAnswers: acertos,
      totalWrongAnswers: erros,
      detalhes: answerHistoryEntry,
    };
  }
}

export { RasaActionService };