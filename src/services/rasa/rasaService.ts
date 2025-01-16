import axios from "axios";
import { AppError } from "../../exceptions/AppError";

interface RasaMessageRequest {
  sender: string;
  message: string;
}

class RasaService {
  private rasaUrl: string;

  constructor() {
    this.rasaUrl = process.env.RASA_URL || "http://rasa:5005/webhooks/rest/webhook";
  }

  async sendMessageToSAEL({ sender, message }: RasaMessageRequest) {
    try {
      const response = await axios.post(this.rasaUrl, { sender, message });

      if (!response.data || response.data.length === 0) {
        throw new AppError("Nenhuma resposta do Rasa foi recebida.", 502);
      }

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

}

export { RasaService };
