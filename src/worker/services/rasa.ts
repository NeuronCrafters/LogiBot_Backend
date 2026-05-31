import { HttpError } from "../errors";
import type { Env } from "../types";

interface RasaQuestion {
  question: string;
  options: string[];
}

interface RasaGeneratedQuestions {
  questions: RasaQuestion[];
  answer_keys: string[];
  metadata?: {
    subject: string;
    level: string;
    generated_at: string;
  };
}

export async function callRasaAction(env: Env, payload: Record<string, unknown>) {
  if (!env.RASA_ACTION) {
    throw new HttpError("RASA_ACTION nao configurado", 503);
  }

  const response = await fetch(env.RASA_ACTION, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new HttpError(`erro no servidor Rasa: ${response.statusText}`, 502);
  }

  return response.json();
}

export async function generateRasaQuestions(env: Env, pergunta: string, nivel: string) {
  const data = await callRasaAction(env, {
    next_action: "action_gerar_perguntas_chatgpt",
    tracker: {
      sender_id: "user",
      slots: { subtopico: pergunta, nivel },
    },
  });

  const responses = (data as { responses?: Array<Record<string, unknown>> }).responses || [];
  let payload: RasaGeneratedQuestions | null = null;

  for (const response of responses) {
    const custom = response.custom as RasaGeneratedQuestions | undefined;
    if (custom && Array.isArray(custom.questions) && Array.isArray(custom.answer_keys)) {
      payload = custom;
      break;
    }
  }

  if (!payload) {
    const rawText = responses.find((response) => typeof response.text === "string")?.text as string | undefined;
    if (rawText) {
      try {
        const parsed = JSON.parse(extractJson(rawText));
        if (Array.isArray(parsed.questions) && Array.isArray(parsed.answer_keys)) {
          payload = parsed;
        }
      } catch {
        payload = null;
      }
    }
  }

  if (!payload) {
    throw new HttpError("nao foi possivel extrair perguntas da resposta do rasa.", 502);
  }

  return {
    perguntas: cleanQuestionOptions(payload.questions),
    gabarito: payload.answer_keys,
    nivel,
    assunto: pergunta,
    metadata: payload.metadata,
  };
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || start >= end) {
    throw new Error("texto nao contem json reconhecivel");
  }
  return text.slice(start, end + 1);
}

function cleanQuestionOptions(questions: RasaQuestion[]) {
  const prefixRegex = /^\s*\(?[a-zA-Z]\)?[\.\)]\s*/;
  return questions.map((question) => ({
    ...question,
    options: question.options.map((option) => (
      prefixRegex.test(option) ? option.replace(prefixRegex, "").trim() : option.trim()
    )),
  }));
}
