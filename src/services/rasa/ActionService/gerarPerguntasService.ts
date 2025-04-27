import axios from "axios";
import { AppError } from "../../../exceptions/AppError";
import { parseQuestionsFromTextService } from "./parseQuestionsFromTextService";
import { FaqStore } from "../../../models/FAQStore";
import { RasaSessionData } from "../types/RasaSessionData";

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

export async function gerarPerguntasService(pergunta: string, session: RasaSessionData) {
  if (!session.nivelAtual) {
    throw new AppError(
      "O nível do usuário precisa ser definido antes de gerar perguntas.",
      400
    );
  }

  try {
    session.lastSubject = pergunta;

    const response = await axios.post(RASA_ACTION_URL, {
      next_action: "action_gerar_perguntas_chatgpt",
      tracker: {
        sender_id: "user",
        slots: {
          subtopico: pergunta,
          nivel: session.nivelAtual
        }
      },
    });

    if (!response.data?.responses?.length) {
      throw new AppError("Resposta do Rasa não contém texto válido.", 500);
    }

    const rawText = response.data.responses[0]?.text;
    session.lastAnswerKeys = response.data.responses[0]?.custom?.answer_keys || [];

    if (!rawText) {
      throw new AppError("Resposta do Rasa não contém texto.", 500);
    }

    const jsonData = parseQuestionsFromTextService(rawText);

    if (!jsonData.questions?.length || jsonData.questions.length !== 5) {
      throw new AppError("Formato inesperado de perguntas na resposta.", 500);
    }

    session.lastQuestions = jsonData.questions.map(q => q.question);

    try {
      await FaqStore.updateOne(
        {
          nivel: session.nivelAtual,
          assunto: session.lastSubject,
          subassunto: session.lastSubject,
        },
        {
          $setOnInsert: {
            nivel: session.nivelAtual,
            assunto: session.lastSubject,
            subassunto: session.lastSubject,
            questions: jsonData.questions,
            answer_keys: session.lastAnswerKeys
          }
        },
        { upsert: true }
      );
    } catch (err) {
      throw new AppError("⚠️ Perguntas já existentes no FaqStore ou erro ao salvar:", err);
    }

    return { questions: jsonData.questions };
  } catch (error) {

    throw new AppError("Erro ao gerar perguntas", 500);
  }
}
