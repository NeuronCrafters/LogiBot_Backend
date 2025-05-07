import axios from "axios";
const RASA_ACTION_URL = process.env.RASA_ACTION as string;

export async function inicioService() {
  const response = await axios.post(RASA_ACTION_URL, {
    next_action: "action_escolher_caminho",
    tracker: { sender_id: "user" }
  });
  return response.data;
}
