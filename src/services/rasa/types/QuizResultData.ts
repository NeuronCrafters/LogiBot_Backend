export interface QuizResultData {
  feedback: any;
  message: string;
  totalCorrectAnswers: number;
  totalWrongAnswers: number;
  detalhes: {
    questions: Array<{
      question: any;
      explanation: any;
      level: string;
      subject: string;
      selectedOption: {
        question: string;
        isCorrect: boolean;
        isSelected: string;
      };
      correctAnswer: string;
      totalCorrectAnswers: number;
      totalWrongAnswers: number;
      timestamp: string;
    }>;
  };
  detailedFeedback: string[];
  percentage: number;
  subject: string;
  nivel: string;
}
