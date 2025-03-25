import axios from "axios";
import { AppError } from "../../../exceptions/AppError";

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

export async function sendOpcaoEListarSubopcoesService(categoria: string) {
  try {
    const response = await axios.post(RASA_ACTION_URL, {
      next_action: "action_listar_subopcoes",
      tracker: {
        sender_id: "user",
        slots: { categoria },
      },
    });

    return response.data;
  } catch (error) {
    throw new AppError("Erro ao obter as subopções", 500);
  }
}
