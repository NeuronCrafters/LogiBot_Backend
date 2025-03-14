import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const rasa_send = process.env.RASA as string

async function rasaSendService(message: string, sender: string) {
  if (!sender) {
    throw new Error("Sender (usuário) não pode ser indefinido.");
  }

  try {
    const response = await axios.post(rasa_send, { sender, message });

    if (!response.data || response.data.length === 0) {
      console.warn("[RasaServiceSend] Nenhuma resposta do Rasa.");
      return [{ text: "Desculpe, não entendi sua pergunta." }];
    }

    return response.data;
  } catch (error) {
    console.error("[RasaServiceSend] Erro ao conectar ao Rasa:", error.message);
    throw new Error("Falha ao se comunicar com o Rasa.");
  }
}

export { rasaSendService };
