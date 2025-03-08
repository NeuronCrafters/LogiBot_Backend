import axios from "axios";
import { AppError } from "../../exceptions/AppError";
import { History } from "../../models/History";
import { userAnalysisManager } from "../userAnalysis/userAnalysisManager";

interface RasaMessageRequest {
  sender: string;
  message: string;
  metadata: Record<string, any>;
}

interface SessionMetadata {
  dispositivo: string;
  name: string;
  email: string;
  role: string[];
  school: string;
}

class RasaSendService {
  private rasaUrl: string;
  private rasaActionUrl: string;

  constructor() {
    this.rasaUrl = process.env.RASA_URL || "http://localhost:5005/webhooks/rest/webhook";
    this.rasaActionUrl = process.env.RASA_ACTION_URL || "http://localhost:5055/webhook";
  }

  async sendMessageToSAEL({ sender, message, metadata }: RasaMessageRequest) {
    try {
      // Converter metadata para o formato aceito pelo banco
      const sessionMetadata: SessionMetadata = {
        dispositivo: metadata.dispositivo || "desconhecido",
        name: metadata.name || "desconhecido",
        email: metadata.email || "desconhecido",
        role: Array.isArray(metadata.role) ? metadata.role : [],
        school: metadata.school || "desconhecido",
      };

      // iniciar ou atualizar sessão do usuário
      await userAnalysisManager.startSession(sender, sessionMetadata);

      // registrar a interação do usuário
      await userAnalysisManager.addInteraction(sender, message);

      // criar payload com os slots (nível, categoria, pergunta) para o Rasa
      const payload = {
        sender,
        message,
        metadata: {
          nivel: metadata.nivel || "desconhecido",
          categoria: metadata.categoria || null,
          pergunta: metadata.pergunta || null,
          dispositivo: metadata.dispositivo || "desconhecido"
        }
      };

      console.log("enviando requisição para Rasa:", payload);

      // enviar mensagem para o Rasa Server
      const response = await axios.post(this.rasaUrl, payload);

      if (!response.data || response.data.length === 0) {
        throw new AppError("nenhuma resposta do Rasa foi recebida.", 502);
      }

      // chamar Action Server se necessário
      const actionResponse = await this.callActionServer(sender, metadata);


      const processedResponse = await this.processQuestionAnswer(sender, response.data);

      await this.saveConversationHistory({
        studentId: sender,
        messages: [
          { sender: "user", text: message },
          ...processedResponse,
          ...(actionResponse ? [{ sender: "bot", text: actionResponse }] : []),
        ],
        metadata,
        startTime: new Date(),
        endTime: new Date(),
      });

      return response.data;
    } catch (error: any) {
      console.error("erro no serviço Rasa:", error);
      if (error.response) {
        throw new AppError(
          `Erro do Rasa: ${error.response.data.message || error.response.statusText}`,
          error.response.status
        );
      } else if (error.request) {
        throw new AppError("falha na comunicação com o Rasa. Nenhuma resposta recebida.", 503);
      } else {
        throw new AppError(`erro desconhecido ao processar mensagem no Rasa: ${error.message}`, 500);
      }
    }
  }

  private async callActionServer(sender: string, metadata: Record<string, any>) {
    try {
      const response = await axios.post(this.rasaActionUrl, {
        tracker: { sender_id: sender, slots: metadata },
      });

      if (!response.data || !response.data.responses || response.data.responses.length === 0) {
        throw new AppError("Resposta inválida do Action Server.", 502);
      }

      return response.data.responses[0]?.text || null;
    } catch (error: any) {
      console.error(`erro ao chamar o Action Server: ${error.message}`);
      throw new AppError(`erro ao chamar o Action Server: ${error.message}`, 500);
    }
  }

  private async processQuestionAnswer(sender: string, rasaResponse: any) {
    const processedMessages = [];

    for (const res of rasaResponse) {
      let text = res.text;

      if (res.custom?.question_id && res.custom?.group_id) {
        const { question_id, correct_answer, group_id } = res.custom;

        const selectedOption = "opção_padrão";
        const isCorrect = selectedOption === correct_answer;

        await userAnalysisManager.registerUserAnswer(sender, group_id, question_id, selectedOption);
        await userAnalysisManager.updateUserAccuracy(sender, isCorrect ? 1 : 0, isCorrect ? 0 : 1);

        text += ` (${isCorrect ? "Acertou!" : "Errou."})`;
      }

      processedMessages.push({ sender: "bot", text });
    }

    return processedMessages;
  }


  private async saveConversationHistory({
    studentId,
    messages,
    metadata,
    startTime,
    endTime,
  }: {
    studentId: string;
    messages: { sender: string; text: string }[];
    metadata: Record<string, any>;
    startTime: Date;
    endTime: Date;
  }) {
    try {
      await History.create({
        student: studentId,
        messages,
        metadata,
        startTime,
        endTime,
      });
      console.log("histórico de conversa salvo com sucesso.");
    } catch (error: any) {
      console.error("erro ao salvar histórico no MongoDB:", error.message);
    }
  }
}

export { RasaSendService };
