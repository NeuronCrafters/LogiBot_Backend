import axios, {AxiosResponse} from "axios";
import dotenv from "dotenv";

dotenv.config();

const rasa_send: string = process.env.RASA;
if (!rasa_send) {
  console.error("Variável de ambiente RASA não definida.");
}

async function rasaSendService(message: string, sender: string): Promise<any> {
  if (!sender) {
    throw new Error("Sender (usuário) não pode ser indefinido.");
  }

  try {
    const response: AxiosResponse<any, any> = await axios.post(rasa_send, { sender, message });

    if (!response.data || response.data.length === 0) {
      console.warn("[RasaServiceSend] Nenhuma resposta do Rasa.");
      return [{ text: "Desculpe, não entendi sua pergunta." }];
    }

    return response.data;

  } catch (error: any) {
    if (error.response) {
      console.error("[RasaServiceSend] Erro ao conectar ao Rasa. Status:", error.response.status, "Dados:", error.response.data);
    } else {
      console.error("[RasaServiceSend] Erro ao conectar ao Rasa:", error.message);
    }
    throw new Error("Falha ao se comunicar com o Rasa.");
  }
}

export { rasaSendService };
