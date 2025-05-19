import axios from "axios";
import { AppError } from "../../../exceptions/AppError";
import { parseQuestionsFromTextService } from "./parseQuestionsFromTextService";
import { RasaSessionData } from "../types/RasaSessionData";

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

export async function gerarPerguntasService(
    pergunta: string,
    session: RasaSessionData
) {
  if (!session.nivelAtual) {
    throw new AppError("O nível do usuário precisa ser definido antes de gerar perguntas.", 400);
  }

  session.lastSubject = pergunta;

  try {
    const response = await axios.post(RASA_ACTION_URL, {
      next_action: "action_gerar_perguntas_chatgpt",
      tracker: {
        sender_id: "user",
        slots: {
          subtopico: pergunta,
          nivel: session.nivelAtual,
        },
      },
    });

    if (!response.data?.responses?.length) {
      throw new AppError("Resposta do Rasa não contém texto válido.", 500);
    }

    const rawText = response.data.responses[0]?.text;

    if (!rawText) {
      throw new AppError("Resposta do Rasa não contém texto.", 500);
    }

    let jsonData: { questions: any[] };
    try {
      jsonData = JSON.parse(rawText);
    } catch {
      jsonData = parseQuestionsFromTextService(rawText);
    }

    if (!Array.isArray(jsonData.questions) || jsonData.questions.length !== 5) {
      throw new AppError("Formato inesperado de perguntas na resposta.", 500);
    }

    const gabarito = response.data.responses[0]?.custom?.answer_keys || [];

    session.lastQuestions = jsonData.questions.map((q: any) => q.question);
    session.lastAnswerKeys = gabarito;

    return {
      perguntas: jsonData.questions,
      gabarito,
      nivel: session.nivelAtual,
      assunto: pergunta,
    };
  } catch (error: any) {
    console.error("gerarPerguntasService falhou:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || "Erro ao gerar perguntas", 500);
  }
}