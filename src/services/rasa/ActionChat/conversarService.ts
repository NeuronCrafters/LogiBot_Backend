import axios from "axios";
const RASA_ACTION_URL = process.env.RASA_ACTION as string;

export async function conversarService() {
  const response = await axios.post(RASA_ACTION_URL, {
    next_action: "action_escolher_caminho",
    tracker: {
      sender_id: "user",
      slots: {
        caminho_escolhido: "conversa"
      }
    }
  });
  return response.data;
}
