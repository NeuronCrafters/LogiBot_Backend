import axios from "axios";
import { AppError } from "../../../exceptions/AppError";
import { parseQuestionsFromTextService } from "./parseQuestionsFromTextService";
import { FaqStore } from "../../../models/FAQStore";
import { RasaSessionData } from "../types/RasaSessionData";
import { MongoServerError } from "mongodb";

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

export async function gerarPerguntasService(
  pergunta: string,
  session: RasaSessionData
) {
  if (!session.nivelAtual) {
    throw new AppError(
      "O nível do usuário precisa ser definido antes de gerar perguntas.",
      400
    );
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

    console.log("=== gerarPerguntasService: resposta completa ===");
    console.dir(response.data, { depth: null });
    console.log("===============================================");

    if (!response.data?.responses?.length) {
      throw new AppError("Resposta do Rasa não contém texto válido.", 500);
    }

    const rawText = response.data.responses[0]?.text;
    console.log("=== gerarPerguntasService: rawText ===");
    console.log(rawText);
    console.log("===============================================");

    if (!rawText) {
      throw new AppError("Resposta do Rasa não contém texto.", 500);
    }

    // tenta interpretar JSON
    let jsonData: { questions: any[] };
    try {
      jsonData = JSON.parse(rawText);
      console.log("=== rawText era JSON válido ===", jsonData);
    } catch {
      console.log("=== rawText NÃO era JSON, usando parser de texto ===");
      jsonData = parseQuestionsFromTextService(rawText);
    }

    console.log("=== gerarPerguntasService: jsonData.questions ===");
    console.dir(jsonData.questions, { depth: null });
    console.log("===============================================");

    if (!Array.isArray(jsonData.questions) || jsonData.questions.length !== 5) {
      throw new AppError("Formato inesperado de perguntas na resposta.", 500);
    }

    session.lastQuestions = jsonData.questions.map((q: any) => q.question);
    session.lastAnswerKeys = response.data.responses[0]?.custom?.answer_keys || [];

    // Salva no FaqStore, mas ignora duplicatas
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
            answer_keys: session.lastAnswerKeys,
          },
        },
        { upsert: true }
      );
    } catch (err: any) {
      if (err instanceof MongoServerError && err.code === 11000) {
        console.warn("gerarPerguntasService: duplicata no FaqStore ignorada.");
      } else {
        console.error("gerarPerguntasService: erro ao salvar no FaqStore:", err);
      }
    }

    return { questions: jsonData.questions };
  } catch (error: any) {
    console.error("✖️ gerarPerguntasService falhou:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || "Erro ao gerar perguntas", 500);
  }
}
