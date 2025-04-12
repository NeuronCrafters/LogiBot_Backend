import axios from "axios";
import { AppError } from "../../../exceptions/AppError";

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

export async function definirNivelService(nivel: string) {
  try {
    const response = await axios.post(RASA_ACTION_URL, {
      next_action: "action_definir_nivel",
      tracker: {
        sender_id: "user",
        slots: { nivel },
      },
    });

    return response.data;
  } catch (error) {
    throw new AppError("Erro ao definir o nível", 500);
  }
}
