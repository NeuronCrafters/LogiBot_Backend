import { FAQStore } from "../../../models/FAQStore";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { userAnalysisManager } from "../userAnalysisManager";

interface UserAnswer {
  userId: string;
  group_id: string;
  question_id: string;
  selectedOption: string;
  isCorrect?: boolean;
}

export class RegisterUserAnswerService {
  async execute({ userId, group_id, question_id, selectedOption }: UserAnswer) {
    try {
      // Buscar o gabarito da questão
      const faqEntry = await FAQStore.findOne({ group_id });

      if (!faqEntry) {
        throw new Error("Gabarito não encontrado.");
      }

      // Encontrar a resposta correta
      const questionIndex = faqEntry.questions.findIndex((q) => q.question_id === question_id);
      if (questionIndex === -1) {
        throw new Error("Pergunta não encontrada no gabarito.");
      }

      const correctAnswer = faqEntry.answer_keys[questionIndex];

      // Verificar se a resposta está correta
      const isCorrect = correctAnswer === selectedOption;

      // Atualizar a análise do usuário
      let userAnalysis = await UserAnalysis.findOne({ userId });

      if (!userAnalysis) {
        userAnalysis = new UserAnalysis({
          userId,
          startTime: new Date(),
          correctAnswers: 0,
          wrongAnswers: 0,
          interactions: [],
          answerHistory: [],
        });
      }

      // Registrar resposta na análise do usuário
      userAnalysis.answerHistory.push({
        question_id,
        selectedOption,
        isCorrect,
        timestamp: new Date(),
      });

      await userAnalysis.save();

      // Atualizar taxa de acertos automaticamente
      await userAnalysisManager.updateUserAccuracy(userId, isCorrect ? 1 : 0, isCorrect ? 0 : 1);

      return { message: `Resposta registrada. ${isCorrect ? "Acertou!" : "Errou."}`, isCorrect };
    } catch (error) {
      throw new Error(`Erro ao registrar resposta: ${error.message}`);
    }
  }
}