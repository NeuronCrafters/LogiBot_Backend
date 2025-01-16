import axios from "axios";
import { AppError } from "../../exceptions/AppError";
import { History } from "../../models/History";

interface RasaMessageRequest {
  sender: string;
  message: string;
  metadata: Record<string, any>;
}

class RasaSendService {
  private rasaUrl: string;

  constructor() {
    this.rasaUrl = process.env.RASA_URL || "http://localhost:5005/webhooks/rest/webhook";
  }

  async sendMessageToSAEL({ sender, message, metadata }: RasaMessageRequest) {
    try {
      // Envia a mensagem para o SAEL
      const response = await axios.post(this.rasaUrl, {
        sender,
        message,
        metadata,
      });

      if (!response.data || response.data.length === 0) {
        throw new AppError("Nenhuma resposta do Rasa foi recebida.", 502);
      }

      // Salvar histórico no Mongo Atlas no Schema Histories
      await this.saveConversationHistory({
        studentId: sender,
        messages: [
          { sender: "user", text: message },
          ...response.data.map((res: any) => ({ sender: "bot", text: res.text })),
        ],
        metadata,
        startTime: new Date(),
        endTime: new Date(),
      });

      return response.data;
    } catch (error: any) {
      console.error("Erro no serviço Rasa:", error);
      if (error.response) {
        throw new AppError(
          `Erro do Rasa: ${error.response.data.message || error.response.statusText}`,
          error.response.status
        );
      } else if (error.request) {
        throw new AppError("Falha na comunicação com o Rasa. Nenhuma resposta recebida.", 503);
      } else {
        throw new AppError(`Erro desconhecido ao processar mensagem no Rasa: ${error.message}`, 500);
      }
    }
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
      console.log("Histórico de conversa salvo com sucesso.");
    } catch (error: any) {
      console.error("Erro ao salvar histórico no MongoDB:", error.message);
    }
  }
}

export { RasaSendService };
