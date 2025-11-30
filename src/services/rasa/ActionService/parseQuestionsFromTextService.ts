export function parseQuestionsFromTextService(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const questions: { question: string; options: string[] }[] = [];

  let currentQuestion: { question: string; options: string[] } | null = null;

  for (const line of lines) {
    const questionMatch = line.match(/^\d+\)\s*(.+)/);
    if (questionMatch) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }

      currentQuestion = {
        question: questionMatch[1].trim(),
        options: [],
      };
      continue;
    }
    const optionMatch = line.match(/^[-*]\s*\(?[a-eA-E]\)?\s*(.+)/);
    if (optionMatch && currentQuestion) {
      currentQuestion.options.push(optionMatch[1].trim());
      continue;
    }

    const fallbackOptionMatch = line.match(/^[a-eA-E]\)\s*(.+)/);
    if (fallbackOptionMatch && currentQuestion) {
      currentQuestion.options.push(fallbackOptionMatch[1].trim());
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  for (const q of questions) {
    if (q.options.length < 2) {
      throw new Error(`pergunta incompleta: "${q.question}"`);
    }
  }

  return { questions };
}
