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
    throw new AppError("O nível do usuário precisa ser definido antes de gerar perguntas.", 400);
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
    }, { timeout: 180000 });

    const responses = response.data.responses || [];
    if (!Array.isArray(responses) || responses.length === 0) {
      throw new AppError("Resposta do Rasa vazia ou malformada.", 502);
    }

    let payload: RasaResponse | null = null;

    for (const r of responses) {
      if (r.custom && Array.isArray(r.custom.questions) && Array.isArray(r.custom.answer_keys)) {
        payload = r.custom;
        break;
      }
    }

    if (!payload) {
      const rawText = responses.find((r: any) => typeof r.text === "string")?.text;
      if (rawText) {
        try {
          const cleaned = extractJson(rawText);
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed.questions) && Array.isArray(parsed.answer_keys)) {
            payload = parsed;
          }
        } catch (e) {
          console.warn("⚠️ Não foi possível extrair JSON da resposta textual.");
        }
      }
    }

    if (!payload) {
      throw new AppError("Não foi possível extrair perguntas da resposta do Rasa.", 502);
    }

    // Validação das perguntas...
    if (!Array.isArray(payload.questions) || payload.questions.length < 5) {
      throw new AppError("Número insuficiente de perguntas geradas.", 502);
    }
    // ... mais validações

    // ==================================================================
    // ✨ AJUSTE AQUI: LIMPA AS PERGUNTAS ANTES DE USÁ-LAS ✨
    const cleanedQuestions = cleanQuestionOptions(payload.questions);
    // ==================================================================

    // Use os dados limpos daqui em diante
    session.lastQuestions = cleanedQuestions.map((q) => q.question);
    session.lastAnswerKeys = payload.answer_keys;

    return {
      perguntas: cleanedQuestions, // <--- Retorna as perguntas limpas
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
    if (error instanceof AppError) throw error;
    if (error.response) {
      throw new AppError(`Erro no servidor de perguntas: ${error.response.statusText}`, 502);
    }
    if (error.request) {
      throw new AppError("Falha na conexão com o servidor de perguntas", 503);
    }
    throw new AppError("Erro inesperado ao gerar perguntas", 500);
  }
}

/**
 * Remove prefixos como "A) ", "B. ", "(C) ", etc., das opções de um quiz.
 */
function cleanQuestionOptions(questions: RasaQuestion[]): RasaQuestion[] {
  // Regex para encontrar prefixos como: A) texto, B. texto, (C) texto, d) texto
  const prefixRegex = /^\s*\(*[a-zA-Z]\)[\s.-]*/;

  return questions.map(q => ({
    ...q,
    options: q.options.map(option =>
      prefixRegex.test(option)
        ? option.replace(prefixRegex, '').trim()
        : option.trim()
    )
  }));
}


// 🔎 Extrai JSON mesmo que esteja sujo ou rodeado de texto
function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || start >= end) {
    throw new Error("Texto não contém JSON reconhecível");
  }
  return text.slice(start, end + 1);
}