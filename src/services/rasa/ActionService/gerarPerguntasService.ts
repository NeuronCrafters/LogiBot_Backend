// src/services/rasa/ActionService/gerarPerguntasService.ts
import axios from "axios";
import { AppError } from "../../../exceptions/AppError";
import { RasaSessionData } from "../types/RasaSessionData";

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

interface RasaQuestion {
  question: string;
  options: string[];
}

interface RasaResponse {
  questions: RasaQuestion[];
  answer_keys: string[];
  metadata?: {
    subject: string;
    level: string;
    generated_at: string;
  };
}

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
    console.log("📡 Enviando requisição para o Rasa...");
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

    console.log(
      "📦 Resposta recebida do Rasa:",
      JSON.stringify(response.data, null, 2)
    );

    const responses = response.data.responses || [];

    // 1) Tenta extrair do custom (já parseado)
    let payload: RasaResponse | null = null;
    const matchedCustom = responses.find((r: any) =>
      r.custom && Array.isArray(r.custom.questions)
    );
    if (matchedCustom) {
      payload = matchedCustom.custom as RasaResponse;
    } else {
      // 2) Fallback: parse do text bruto
      const rawText = responses[0]?.text;
      if (typeof rawText !== "string") {
        console.error("❌ Nenhum texto bruto para parsear JSON");
        throw new AppError("Resposta do servidor de perguntas mal formatada", 500);
      }
      const cleaned = extractJson(rawText);
      payload = JSON.parse(cleaned) as RasaResponse;
    }

    if (!payload) {
      console.error("❌ Payload vazio ou mal formatado da resposta do Rasa");
      throw new AppError("Resposta do servidor de perguntas mal formatada", 500);
    }

    console.log("🔍 Validando estrutura das perguntas...");

    if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
      console.error("❌ Lista de perguntas inválida ou vazia");
      throw new AppError("Nenhuma pergunta foi gerada", 500);
    }

    for (const [index, question] of payload.questions.entries()) {
      if (!question.question || typeof question.question !== "string") {
        console.error(`❌ Pergunta ${index + 1} sem texto válido`);
        throw new AppError(`Pergunta ${index + 1} sem texto válido`, 500);
      }
      if (!Array.isArray(question.options)) {
        console.error(`❌ Opções da pergunta ${index + 1} não são uma lista`);
        throw new AppError(
          `Opções da pergunta ${index + 1} inválidas`,
          500
        );
      }
    }

    if (!Array.isArray(payload.answer_keys)) {
      console.warn(
        "⚠️ Campo 'answer_keys' não é uma array, usando array vazia"
      );
      payload.answer_keys = [];
    }

    // Atualiza a sessão
    session.lastQuestions = payload.questions.map((q) => q.question);
    session.lastAnswerKeys = payload.answer_keys;

    console.log("✅ Perguntas validadas com sucesso");

    return {
      perguntas: payload.questions,
      gabarito: payload.answer_keys,
      nivel: session.nivelAtual,
      assunto: pergunta,
      metadata: payload.metadata,
    };
  } catch (error: any) {
    console.error("❌ Erro no gerarPerguntasService:", {
      error: error.message,
      response: error.response?.data,
    });

    if (error instanceof AppError) {
      throw error;
    }
    if (error.response) {
      throw new AppError(
        `Erro no servidor de perguntas: ${error.response.statusText}`,
        502
      );
    }
    if (error.request) {
      throw new AppError(
        "Não foi possível conectar ao servidor de perguntas",
        503
      );
    }
    throw new AppError(error.message || "Erro desconhecido ao gerar perguntas", 500);
  }
}

/** 
 * Remove tudo antes do primeiro '{' e depois do último '}' para obter JSON bruto 
 */
function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) {
    throw new Error("Não foi possível encontrar JSON no texto");
  }
  return text.slice(start, end + 1);
}
