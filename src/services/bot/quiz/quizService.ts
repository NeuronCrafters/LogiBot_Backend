import fs from 'fs';
import path from 'path';
import { AppError } from '../../../exceptions/AppError';
import { Quiz, QuizQuestion, ResultDetail } from './quiz.types';
import { levels, categories, subcategories } from './quizData';

const DB_PATH = path.join(__dirname, '../../../database/quiz_database.json');

export function getLevelsService() {
  return levels.map(level => ({ title: level.charAt(0).toUpperCase() + level.slice(1), payload: level }));
}

export function getCategoriesService() {
  return categories.map(category => ({ title: category.toUpperCase().replace(/_/g, ' '), payload: category }));
}

export function getSubcategoriesService(category: string) {
  const subs = subcategories[category];
  if (!subs) {
    throw new AppError(`Categoria '${category}' não encontrada.`, 404);
  }
  return subs.map(sub => ({ title: sub.replace(/_/g, ' ').charAt(0).toUpperCase() + sub.slice(1).replace(/_/g, ' '), payload: sub }));
}

export function generateQuizService(subtopic: string, level: string): Quiz {
  try {
    const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
    const allQuizzes: Quiz[] = JSON.parse(fileContent);

    const matchingQuizzes = allQuizzes.filter(quiz =>
      quiz.subject.toLowerCase() === subtopic.toLowerCase() &&
      quiz.level.toLowerCase() === level.toLowerCase()
    );

    if (matchingQuizzes.length === 0) {
      throw new AppError(`Nenhum quiz encontrado para o tópico '${subtopic}' no nível '${level}'.`, 404);
    }

    const randomQuiz = matchingQuizzes[Math.floor(Math.random() * matchingQuizzes.length)];
    return randomQuiz;

  } catch (error: any) {

    if (error instanceof AppError) throw error;
    throw new AppError("erro interno ao ler o banco de dados de quizzes.", 500);
  }
}

export function verifyQuizAnswersService(
  userAnswers: string[],
  correctAnswers: string[],
  originalQuestions: QuizQuestion[]
) {
  const resultDetails: Partial<ResultDetail>[] = [];
  let correctCount = 0;

  for (let i = 0; i < correctAnswers.length; i++) {
    const userAnswer = (userAnswers[i] || "").trim().toUpperCase();
    const correctAnswer = (correctAnswers[i] || "").trim().toUpperCase();
    const isCorrect = userAnswer === correctAnswer;

    if (isCorrect) {
      correctCount++;
    }

    const getOptionText = (letter: string, question: QuizQuestion): string => {
      if (!letter || !question || !question.options) return "Resposta inválida";
      const index = letter.charCodeAt(0) - 'A'.charCodeAt(0);
      return question.options[index] || "Opção não encontrada";
    };

    const selectedText = getOptionText(userAnswer, originalQuestions[i]);
    const correctText = getOptionText(correctAnswer, originalQuestions[i]);
    const explanationObject = originalQuestions[i]?.explanation || {};
    const explanationText =
      explanationObject[userAnswer] ||
      "Não foi encontrada uma explicação para esta opção.";

    resultDetails.push({
      question: originalQuestions[i]?.question || "Pergunta não encontrada",
      selected: userAnswer,
      correct: correctAnswer,
      isCorrect: isCorrect,
      explanation: explanationText,
      selectedText: selectedText,
      correctText: correctText,
    });
  }

  return {
    message: `Você acertou ${correctCount} de ${correctAnswers.length}.`,
    totalCorrectAnswers: correctCount,
    totalWrongAnswers: correctAnswers.length - correctCount,
    detalhes: resultDetails as ResultDetail[],
  };
}