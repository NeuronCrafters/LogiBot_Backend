import axios from "axios";
import { AppError } from "../../exceptions/AppError";

interface RasaMessageRequest {
  sender: string;
  message: string;
}

class RasaService {
  private rasaUrl: string;

  constructor() {
    this.rasaUrl = process.env.RASA_URL || "http://localhost:5005/webhooks/rest/webhook";
  }

  async sendMessageToSAEL({ sender, message }: RasaMessageRequest) {
    try {
      const response = await axios.post(this.rasaUrl, {
        sender,
        message,
      });

      if (!response.data || response.data.length === 0) {
        throw new AppError("Nenhuma resposta do Rasa", 502);
      }

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new AppError(`Erro do Rasa: ${error.response.data.message}`, error.response.status);
      } else if (error.request) {
        throw new AppError("Falha na comunicação com o Rasa", 503);
      } else {
        throw new AppError("Erro ao processar mensagem no Rasa", 500);
      }
    }
  }
}

export { RasaService };
