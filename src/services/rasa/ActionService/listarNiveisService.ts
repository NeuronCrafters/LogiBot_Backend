import axios from "axios";
import { AppError } from "../../../exceptions/AppError";

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

export async function listarNiveisService() {
  try {
    const response = await axios.post(RASA_ACTION_URL, {
      next_action: "action_listar_niveis",
      tracker: { sender_id: "user" }
    });

    return response.data;
  } catch (error: any) {

    throw new AppError("erro ao obter os níveis", 500);
  }
}
