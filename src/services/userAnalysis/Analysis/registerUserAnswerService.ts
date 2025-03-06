import { FAQStore } from "../../../models/FAQStore";
import { UserAnalysis } from "../../../models/UserAnalysis";

interface UserAnswer {
  userId: string;
  group_id: string;
  questionIndex: number;
  selectedOption: string;
}

export class RegisterUserAnswerService {
  async execute({ userId, group_id, questionIndex, selectedOption }: UserAnswer) {
    try {
      // Buscar o gabarito da questão
      const faqEntry = await FAQStore.findOne({ group_id });

      if (!faqEntry) {
        throw new Error("Gabarito não encontrado.");
      }

      // Pegar a resposta correta
      const correctAnswer = faqEntry.answer_keys[questionIndex];

      // Verificar se a resposta está correta
      const isCorrect = correctAnswer === selectedOption;

      // Atualizar a análise do usuário
      let userAnalysis = await UserAnalysis.findOne({ userId });

      if (!userAnalysis) {
        userAnalysis = new UserAnalysis({
          userId,
          startTime: new Date(),
          taxaDeAcertos: 0,
          outOfScopeQuestions: 0,
          interactions: [],
        });
      }

      // Atualiza a taxa de acertos
      if (isCorrect) {
        userAnalysis.taxaDeAcertos += 1;
      }

      // Adiciona interação ao histórico
      userAnalysis.interactions.push({
        timestamp: new Date(),
        message: `Pergunta ${questionIndex + 1}: ${selectedOption} (${isCorrect ? "Acertou" : "Errou"})`,
      });

      await userAnalysis.save();

      return { message: `Resposta registrada. ${isCorrect ? "Acertou!" : "Errou."}`, isCorrect };
    } catch (error) {
      throw new Error(`Erro ao registrar resposta: ${error.message}`);
    }
  }
}
