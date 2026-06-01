import quizDatabase from "../../../database/quiz/quiz_database.json";
import { AppError } from "../../../exceptions/AppError";

export interface SaelQuestion {
  question: string;
  options: string[];
  explanation?: Record<string, string>;
}

export interface SaelQuiz {
  subject: string;
  level: string;
  questions: SaelQuestion[];
  answer_keys: string[];
}

const allQuizzes = quizDatabase as SaelQuiz[];

const levels = ["basico", "intermediario"];

const categories = [
  "variaveis",
  "listas",
  "condicionais",
  "funcoes",
  "operadores_logicos",
];

const subcategories: Record<string, string[]> = {
  variaveis: [
    "o_que_sao_variaveis",
    "tipos_existentes_de_variaveis",
    "variaveis_mutaveis",
    "operacoes_de_concatenacao_de_textos",
    "o_que_sao_caracteres",
    "como_converter_caracteres",
  ],
  listas: [
    "o_que_sao_listas",
    "adicionar_elemento_na_lista",
    "remover_elemento_da_lista",
    "ordenar_lista",
    "acessar_elemento_da_lista",
  ],
  condicionais: ["o_que_sao_condicionais"],
  funcoes: ["o_que_sao_funcoes", "como_usar_funcoes", "tipos_de_funcoes"],
  operadores_logicos: ["o_que_sao_operadores_logicos"],
};

export function getLevelButtons() {
  return levels.map((level) => ({
    title: level.charAt(0).toUpperCase() + level.slice(1),
    payload: level,
  }));
}

export function getCategoryButtons() {
  return categories.map((category) => ({
    title: category.toUpperCase().replace(/_/g, " "),
    payload: category,
  }));
}

export function getSubcategoryButtons(category: string) {
  const normalized = normalizeText(category);
  const subs = subcategories[normalized];
  if (!subs) {
    throw new AppError(`categoria '${category}' nao encontrada.`, 404);
  }

  return subs.map((sub) => ({
    title: formatTitle(sub),
    payload: JSON.stringify({ subtopico: sub }),
  }));
}

export function findLocalQuiz(subtopic: string, level: string): SaelQuiz {
  const normalizedSubtopic = normalizeText(subtopic);
  const normalizedLevel = normalizeText(level);
  const matchingQuizzes = allQuizzes.filter((quiz) => (
    normalizeText(quiz.subject) === normalizedSubtopic &&
    normalizeText(quiz.level) === normalizedLevel
  ));

  if (!matchingQuizzes.length) {
    throw new AppError(`nenhum quiz encontrado para '${subtopic}' no nivel '${level}'.`, 404);
  }

  return matchingQuizzes[Math.floor(Math.random() * matchingQuizzes.length)];
}

export function cleanQuestionOptions(questions: SaelQuestion[]) {
  const prefixRegex = /^\s*\(?[a-zA-Z]\)?[\.\)]\s*/;
  return questions.map((question) => ({
    ...question,
    options: question.options.map((option) => (
      prefixRegex.test(option) ? option.replace(prefixRegex, "").trim() : option.trim()
    )),
  }));
}

function formatTitle(value: string) {
  const title = value.replace(/_/g, " ");
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .replace(/õ/g, "o")
    .replace(/ã/g, "a")
    .replace(/á/g, "a")
    .replace(/í/g, "i")
    .replace(/é/g, "e")
    .replace(/ó/g, "o");
}
