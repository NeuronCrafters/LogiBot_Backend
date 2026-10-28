import { t } from "../../i18n";
export type QuizCheckResult = {
  correct: number;
  wrong: number;
  detalhes: Array<{
    question: string;
    selected: string;
    correct: string;
    isCorrect: boolean;
    explanation: string;
    selectedText: string;
    correctText: string;
  }>;
};

type QuestionForCheck = {
  id: string;
  question: string;
  options: string[];
  correctOption: string;
  explanation: string | null;
};

function optionText(letter: string, options: string[]): string {
  const index = letter.toUpperCase().charCodeAt(0) - 65;
  return options[index] ?? t("quiz.optionNotFound");
}

export function checkAnswers(
  questions: QuestionForCheck[],
  answers: Record<string, string>,
): QuizCheckResult {
  let correct = 0;
  const detalhes = questions.map((q) => {
    const selected = (answers[q.id] ?? "").toUpperCase();
    const correctLetter = q.correctOption.toUpperCase();
    const isCorrect = selected === correctLetter;
    if (isCorrect) correct++;
    return {
      question: q.question,
      selected,
      correct: correctLetter,
      isCorrect,
      explanation: q.explanation ?? "",
      selectedText: selected ? optionText(selected, q.options) : "",
      correctText: optionText(correctLetter, q.options),
    };
  });
  return { correct, wrong: questions.length - correct, detalhes };
}
