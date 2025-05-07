import axios from "axios";
import { AppError } from "../../../exceptions/AppError";

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

export async function actionPerguntarService(userText: string, senderId: string) {
  try {
    const response = await axios.post(RASA_ACTION_URL, {
      next_action: "action_conversa_chatgpt",
      tracker: {
        sender_id: senderId,
        latest_message: {
          text: userText
        },
        slots: {
          caminho_escolhido: "conversa"
        }
      }
    });

    return response.data;
  } catch (error: any) {
    console.error("Erro no actionPerguntarService:", error.message);
    throw new AppError("Erro ao conversar com o assistente de lógica", 500);
  }
}
