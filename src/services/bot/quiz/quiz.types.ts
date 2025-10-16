export interface QuizQuestion {
  question: string;
  options: string[];
  explanation: Record<string, string>;
}

// define a estrutura completa de um quiz
export interface Quiz {
  subject: string;
  level: string;
  questions: QuizQuestion[];
  answer_keys: string[];
}

// define a estrutura do detalhe do resultado para uma questão
export interface ResultDetail {
  question: string;
  selected: string;
  correct: string;
  isCorrect: boolean;
  explanation: string;
  selectedText: string;
  correctText: string;
}

export interface QuizSessionData {
  nivelAtual: string | null;
  lastAnswerKeys: string[];
  lastSubject: string | null;
  lastQuestions: string[];
  lastFullQuestions?: any[];
}
