import axios from "axios";

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

export async function obterNivelAtualService(): Promise<string | null> {
  try {
    const response = await axios.post(RASA_ACTION_URL, {
      next_action: "action_obter_nivel",
      tracker: { sender_id: "user" },
    });

    if (!response.data || !response.data.nivel) {
      return null;
    }

    return response.data.nivel;
  } catch (error) {
    return null;
  }
}
