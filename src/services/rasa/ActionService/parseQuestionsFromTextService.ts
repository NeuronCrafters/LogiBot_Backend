export function parseQuestionsFromTextService(text: string) {
  const lines = text.split("\n");
  const questions = [];
  let currentQuestion = null;

  for (const line of lines) {
    const questionMatch = line.match(/^\d+\)\s*(.*)/);
    if (questionMatch) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        question: questionMatch[1].trim(),
        options: [],
      };
    } else if (line.trim().startsWith("- (")) {
      if (currentQuestion) {
        currentQuestion.options.push(line.trim().substring(3));
      }
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return { questions };
}
