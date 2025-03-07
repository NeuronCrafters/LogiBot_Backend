import { FAQStore } from "../../../models/FAQStore";

interface UserAnswerRequest {
  userId: string;
  question_id: string;
}

export class GetUserAnswerService {
  async execute({ userId, question_id }: UserAnswerRequest) {
    try {
      // busca no banco de dados a resposta do usuário para a pergunta específica
      const faqEntry = await FAQStore.findOne({ "user_answers.question_id": question_id });

      if (!faqEntry) {
        throw new Error("Pergunta não encontrada no FAQStore.");
      }

      // encontra a resposta específica do usuário
      const userAnswer = faqEntry.user_answers?.find(
        (answer) => answer.userId === userId && answer.question_id === question_id
      );

      if (!userAnswer) {
        return { message: "Nenhuma resposta registrada para essa pergunta.", answer: null };
      }

      return {
        question_id,
        selectedOption: userAnswer.selectedOption,
        isCorrect: userAnswer.isCorrect,
        timestamp: userAnswer.timestamp,
      };
    } catch (error) {
      throw new Error(`Erro ao buscar resposta do usuário: ${error.message}`);
    }
  }
}
