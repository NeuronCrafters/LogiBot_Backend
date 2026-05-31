import quizDatabase from "../../database/quiz/quiz_database.json";
import { HttpError } from "../errors";

export interface QuizQuestion {
  question: string;
  options: string[];
  explanation: Record<string, string>;
}

export interface Quiz {
  subject: string;
  level: string;
  questions: QuizQuestion[];
  answer_keys: string[];
}

export interface ResultDetail {
  question: string;
  selected: string;
  correct: string;
  isCorrect: boolean;
  explanation: string;
  selectedText: string;
  correctText: string;
}

const allQuizzes = quizDatabase as Quiz[];

export const levels = ["basico", "intermediario"];

export const categories = [
  "variáveis",
  "listas",
  "condicionais",
  "funções",
  "operadores_lógicos",
];

export const subcategories: Record<string, string[]> = {
  "variáveis": [
    "o_que_são_variáveis",
    "tipos_existentes_de_variáveis",
    "variáveis_mutáveis",
    "operações_de_concatenacao_de_textos",
    "o_que_são_caracteres",
    "como_converter_caracteres",
  ],
  listas: [
    "o_que_são_listas",
    "adicionar_elemento_na_lista",
    "remover_elemento_da_lista",
    "ordenar_lista",
    "acessar_elemento_da_lista",
  ],
  condicionais: ["o_que_são_condicionais"],
  "funções": ["o_que_são_funções", "como_usar_funções", "tipos_de_funções"],
  "operadores_lógicos": ["o_que_são_operadores_lógicos"],
};

export function getLevels() {
  return levels.map((level) => ({ title: level.charAt(0).toUpperCase() + level.slice(1), payload: level }));
}

export function getCategories() {
  return categories.map((category) => ({ title: category.toUpperCase().replace(/_/g, " "), payload: category }));
}

export function getSubcategories(category: string) {
  const subs = subcategories[category];
  if (!subs) {
    throw new HttpError(`Categoria '${category}' nao encontrada.`, 404);
  }

  return subs.map((sub) => ({
    title: sub.replace(/_/g, " ").charAt(0).toUpperCase() + sub.slice(1).replace(/_/g, " "),
    payload: sub,
  }));
}

export function generateQuiz(subtopic: string, level: string): Quiz {
  const matchingQuizzes = allQuizzes.filter((quiz) => (
    quiz.subject.toLowerCase() === subtopic.toLowerCase()
    && quiz.level.toLowerCase() === level.toLowerCase()
  ));

  if (matchingQuizzes.length === 0) {
    throw new HttpError(`Nenhum quiz encontrado para o topico '${subtopic}' no nivel '${level}'.`, 404);
  }

  return matchingQuizzes[Math.floor(Math.random() * matchingQuizzes.length)];
}

export function verifyQuizAnswers(userAnswers: string[], correctAnswers: string[], originalQuestions: QuizQuestion[]) {
  const detalhes: ResultDetail[] = [];
  let correctCount = 0;

  for (let i = 0; i < correctAnswers.length; i++) {
    const userAnswer = (userAnswers[i] || "").trim().toUpperCase();
    const correctAnswer = (correctAnswers[i] || "").trim().toUpperCase();
    const isCorrect = userAnswer === correctAnswer;
    if (isCorrect) correctCount++;

    const question = originalQuestions[i];
    const selectedText = getOptionText(userAnswer, question);
    const correctText = getOptionText(correctAnswer, question);
    const explanationText = question?.explanation?.[userAnswer] || "Nao foi encontrada uma explicacao para esta opcao.";

    detalhes.push({
      question: question?.question || "Pergunta nao encontrada",
      selected: userAnswer,
      correct: correctAnswer,
      isCorrect,
      explanation: explanationText,
      selectedText,
      correctText,
    });
  }

  return {
    message: `Voce acertou ${correctCount} de ${correctAnswers.length}.`,
    totalCorrectAnswers: correctCount,
    totalWrongAnswers: correctAnswers.length - correctCount,
    detalhes,
  };
}

function getOptionText(letter: string, question?: QuizQuestion) {
  if (!letter || !question?.options) return "Resposta invalida";
  const index = letter.charCodeAt(0) - "A".charCodeAt(0);
  return question.options[index] || "Opcao nao encontrada";
}
