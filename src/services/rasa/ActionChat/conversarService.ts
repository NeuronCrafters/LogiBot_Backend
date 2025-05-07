import axios from "axios";
const RASA_ACTION_URL = process.env.RASA_ACTION as string;

export async function conversarService(userText: string) {
  const response = await axios.post(RASA_ACTION_URL, {
    next_action: "action_conversa_chatgpt",
    tracker: {
      sender_id: "user",
      latest_message: {
        text: userText
      },
      slots: {
        caminho_escolhido: "conversa"
      }
    }
  });
  return response.data;
}
