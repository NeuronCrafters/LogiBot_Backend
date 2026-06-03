import quizDatabase from "../../database/quiz/quiz_database.json";
import { AppError } from "../../exceptions/AppError";

export type RuntimeSession = {
  nivelAtual: string | null;
  lastAnswerKeys: string[];
  lastSubject: string | null;
  lastQuestions: string[];
  lastFullQuestions: QuizQuestion[];
};

export type QuizQuestion = {
  question: string;
  options: string[];
  explanation?: Record<string, string>;
};

export type Quiz = {
  subject: string;
  level: string;
  questions: QuizQuestion[];
  answer_keys: string[];
};

const allQuizzes = quizDatabase as Quiz[];
const runtimeSessions = new Map<string, RuntimeSession>();
const levels = ["basico", "intermediario"];
const categories = ["variÃ¡veis", "listas", "condicionais", "funÃ§Ãµes", "operadores_lÃ³gicos"];
const subcategories: Record<string, string[]> = {
  variaveis: [
    "o_que_sao_variaveis",
    "tipos_existentes_de_variaveis",
    "variaveis_mutaveis",
    "operacoes_de_concatenacao_de_textos",
    "o_que_sao_caracteres",
    "como_converter_caracteres",
  ],
  "variÃ¡veis": [
    "o_que_sÃ£o_variÃ¡veis",
    "tipos_existentes_de_variÃ¡veis",
    "variÃ¡veis_mutÃ¡veis",
    "operaÃ§Ãµes_de_concatenacao_de_textos",
    "o_que_sÃ£o_caracteres",
    "como_converter_caracteres",
  ],
  listas: [
    "o_que_sao_listas",
    "adicionar_elemento_na_lista",
    "remover_elemento_da_lista",
    "ordenar_lista",
    "acessar_elemento_da_lista",
  ],
  condicionais: ["o_que_sao_condicionais", "o_que_sÃ£o_condicionais"],
  funcoes: ["o_que_sao_funcoes", "como_usar_funcoes", "tipos_de_funcoes"],
  "funÃ§Ãµes": ["o_que_sÃ£o_funÃ§Ãµes", "como_usar_funÃ§Ãµes", "tipos_de_funÃ§Ãµes"],
  operadores_logicos: ["o_que_sao_operadores_logicos"],
  "operadores_lÃ³gicos": ["o_que_sÃ£o_operadores_lÃ³gicos"],
};

function button(title: string, payload: string) {
  return { title, payload };
}

export function getRuntimeSession(userId: string): RuntimeSession {
  const existing = runtimeSessions.get(userId);
  if (existing) return existing;

  const created: RuntimeSession = {
    nivelAtual: null,
    lastAnswerKeys: [],
    lastSubject: null,
    lastQuestions: [],
    lastFullQuestions: [],
  };
  runtimeSessions.set(userId, created);
  return created;
}

export function getLevels() {
  return levels.map((level) => button(level.charAt(0).toUpperCase() + level.slice(1), level));
}

export function getCategories() {
  return categories.map((category) => button(category.toUpperCase().replace(/_/g, " "), category));
}

export function getSubcategories(category: string) {
  const subs = subcategories[category] || subcategories[normalizeKey(category)];
  if (!subs) throw new AppError(`Categoria '${category}' nao encontrada.`, 404);
  return subs.map((sub) => button(formatTitle(sub), sub));
}

export function normalizeKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Ã§/g, "c").replace(/Ãµ/g, "o");
}

export function formatTitle(value: string) {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function generateQuiz(subtopic: string, level: string): Quiz {
  const normalizedSubtopic = normalizeKey(subtopic).toLowerCase();
  const matchingQuizzes = allQuizzes.filter((quiz) => (
    normalizeKey(quiz.subject).toLowerCase() === normalizedSubtopic
    && normalizeKey(quiz.level).toLowerCase() === normalizeKey(level).toLowerCase()
  ));

  if (!matchingQuizzes.length) {
    throw new AppError(`Nenhum quiz encontrado para o topico '${subtopic}' no nivel '${level}'.`, 404);
  }

  return matchingQuizzes[Math.floor(Math.random() * matchingQuizzes.length)];
}

function optionText(letter: string, question?: QuizQuestion) {
  if (!letter || !question?.options) return "Resposta invalida";
  const index = letter.charCodeAt(0) - "A".charCodeAt(0);
  return question.options[index] || "Opcao nao encontrada";
}

export function verifyQuizAnswers(userAnswers: string[], correctAnswers: string[], originalQuestions: QuizQuestion[]) {
  let correctCount = 0;
  const detalhes = correctAnswers.map((correctAnswerRaw, index) => {
    const selected = (userAnswers[index] || "").trim().toUpperCase();
    const correct = (correctAnswerRaw || "").trim().toUpperCase();
    const isCorrect = selected === correct;
    if (isCorrect) correctCount++;
    const question = originalQuestions[index];
    return {
      question: question?.question || "Pergunta nao encontrada",
      selected,
      correct,
      isCorrect,
      explanation: question?.explanation?.[selected] || "Nao foi encontrada uma explicacao para esta opcao.",
      selectedText: optionText(selected, question),
      correctText: optionText(correct, question),
    };
  });

  return {
    message: `Voce acertou ${correctCount} de ${correctAnswers.length}.`,
    totalCorrectAnswers: correctCount,
    totalWrongAnswers: correctAnswers.length - correctCount,
    detalhes,
  };
}
