import { HttpError } from "../errors";
import type { Env } from "../types";
import {
  generateQuiz,
  getCategories,
  getLevels,
  getSubcategories,
} from "./quiz";

interface SaelQuestion {
  question: string;
  options: string[];
}

export async function callRasaAction(_env: Env, payload: Record<string, unknown>) {
  const action = payload.next_action;
  const tracker = payload.tracker as { slots?: Record<string, string> } | undefined;

  if (action === "action_escolher_caminho") {
    return { responses: [{ text: "Escolha se deseja conversar ou praticar com um quiz." }] };
  }

  if (action === "action_listar_niveis") {
    return { responses: [{ text: "Escolha um nivel:", buttons: getLevels() }] };
  }

  if (action === "action_definir_nivel") {
    return { responses: [{ text: `Nivel ${tracker?.slots?.nivel || ""} definido.` }] };
  }

  if (action === "action_listar_opcoes") {
    return { responses: [{ text: "Escolha um assunto:", buttons: getCategories() }] };
  }

  if (action === "action_listar_subopcoes") {
    const categoria = tracker?.slots?.categoria;
    if (!categoria) throw new HttpError("categoria obrigatoria", 400);
    return { responses: [{ text: "Escolha um topico:", buttons: getSubcategories(categoria) }] };
  }

  throw new HttpError("acao SAEL legada nao suportada sem Rasa.", 501);
}

export async function generateRasaQuestions(_env: Env, pergunta: string, nivel: string) {
  const payload = generateQuiz(pergunta, nivel);
  const questions = cleanQuestionOptions(payload.questions);

  return {
    perguntas: questions,
    questions,
    gabarito: payload.answer_keys,
    answer_keys: payload.answer_keys,
    nivel,
    assunto: pergunta,
    metadata: {
      subject: pergunta,
      level: nivel,
      generated_at: new Date().toISOString(),
    },
  };
}

function cleanQuestionOptions(questions: SaelQuestion[]) {
  const prefixRegex = /^\s*\(?[a-zA-Z]\)?[\.\)]\s*/;
  return questions.map((question) => ({
    ...question,
    options: question.options.map((option) => (
      prefixRegex.test(option) ? option.replace(prefixRegex, "").trim() : option.trim()
    )),
  }));
}
