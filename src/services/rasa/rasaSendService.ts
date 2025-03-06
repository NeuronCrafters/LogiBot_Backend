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
  private rasaActionUrl: string;

  constructor() {
    this.rasaUrl = process.env.RASA_URL || "http://localhost:5005/webhooks/rest/webhook";
    this.rasaActionUrl = process.env.RASA_ACTION_URL || "http://localhost:5055/webhook";
  }

  async sendMessageToSAEL({ sender, message, metadata }: RasaMessageRequest) {
    try {
      // Enviar mensagem para o Rasa Server
      const response = await axios.post(this.rasaUrl, {
        sender,
        message,
        metadata,
      });

      if (!response.data || response.data.length === 0) {
        throw new AppError("Nenhuma resposta do Rasa foi recebida.", 502);
      }

      // Chamar Action Server (se necessário)
      const actionResponse = await this.callActionServer(sender, metadata);

      // Salvar histórico no MongoDB
      await this.saveConversationHistory({
        studentId: sender,
        messages: [
          { sender: "user", text: message },
          ...response.data.map((res: any) => ({ sender: "bot", text: res.text })),
          ...(actionResponse ? [{ sender: "bot", text: actionResponse }] : []), // Adicionar resposta do Action Server se houver
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

  private async callActionServer(sender: string, metadata: Record<string, any>) {
    try {
      const response = await axios.post(this.rasaActionUrl, {
        tracker: {
          sender_id: sender,
          slots: metadata,
        },
      });

      if (!response.data || !response.data.responses || response.data.responses.length === 0) {
        throw new AppError("Resposta inválida do Action Server.", 502);
      }

      return response.data.responses[0]?.text || null;
    } catch (error: any) {
      console.error(`Erro ao chamar o Action Server: ${error.message}`);
      throw new AppError(`Erro ao chamar o Action Server: ${error.message}`, 500);
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
