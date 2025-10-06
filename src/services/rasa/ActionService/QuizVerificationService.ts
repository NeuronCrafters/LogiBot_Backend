import axios from "axios";
import { AppError } from "../../../exceptions/AppError";
import { RasaSessionData } from "../types/RasaSessionData";
import { QuizResultData } from "../types/QuizResultData";

class OllamaApiService {
  private agents: { url: string; key: string }[] = [];
  private currentAgentIndex = 0;

  constructor() {
    this.loadAgentsFromEnv();
    if (this.agents.length === 0) {
      console.error("❌ ERRO FATAL: Nenhuma configuração de agente de IA encontrada nas variáveis de ambiente.");
    }
  }

  private loadAgentsFromEnv(): void {
    for (let i = 1; i <= 12; i++) {
      const url = process.env[`OLLAMA_API_URL_${i}`];
      const key = process.env[`Key_A${i}`];
      if (url && key) {
        this.agents.push({ url, key });
      }
    }
  }

  private getNextAgent(): { url: string; key: string } {
    const agent = this.agents[this.currentAgentIndex];
    this.currentAgentIndex = (this.currentAgentIndex + 1) % this.agents.length;
    return agent;
  }

  async generateExplanation(question: string, userAnswer: string, correctAnswer: string): Promise<string> {
    if (this.agents.length === 0) {
      return "Erro: A configuração da API de IA está ausente.";
    }

    const agent = this.getNextAgent();
    const prompt = `
            Você é um tutor de programação especializado e conciso. Sua tarefa é explicar o erro em uma resposta de quiz.

            - Pergunta: "${question}"
            - Resposta do Usuário (Incorreta): "${userAnswer}"
            - Resposta Correta: "${correctAnswer}"

            **Instruções:**
            1.  Seja **breve** e vá **direto ao ponto** (máximo de 2 a 3 frases).
            2.  Concentre-se no **conceito técnico** por trás da resposta correta.
            3.  **NÃO** use frases de abertura como "Sua resposta está incorreta". Comece a explicação diretamente.
            4.  Responda em português do Brasil.
        `;

    try {
      const response = await axios.post(
        agent.url,
        {
          model: "llama3",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          stream: false,
        },
        {
          headers: {
            "Authorization": `Bearer ${agent.key}`,
            "Content-Type": "application/json",
          },
          timeout: 180000,
        }
      );
      return response.data.choices[0]?.message?.content || "Não foi possível gerar a explicação.";
    } catch (error: any) {
      console.error(`Erro ao chamar a API de IA (${agent.url}):`, error.message);
      return `Erro ao gerar explicação: ${error.message}`;
    }
  }
}


// Serviço principal de verificação
export class QuizVerificationService {
  private ollamaApi: OllamaApiService;

  constructor() {
    this.ollamaApi = new OllamaApiService();
  }

  async verifyAnswers(respostas: string[], session: RasaSessionData): Promise<QuizResultData> {
    const { lastQuestions, lastAnswerKeys, nivelAtual, lastSubject } = session;

    if (!lastQuestions || !lastAnswerKeys) {
      throw new AppError("Sessão inválida: dados do quiz ausentes.", 400);
    }

    // 1. Avalia as respostas (certo/errado)
    let correctCount = 0;
    const resultDetails = lastQuestions.map((questionData, i) => {
      const userAnswer = respostas[i]?.trim().toUpperCase();
      const correctAnswer = lastAnswerKeys[i]?.trim().toUpperCase();
      const isCorrect = userAnswer === correctAnswer;
      if (isCorrect) {
        correctCount++;
      }
      return {
        question: questionData.question,
        selected: userAnswer,
        correct: correctAnswer,
        isCorrect: isCorrect,
        explanation: isCorrect ? "Parabéns, sua resposta está correta!" : "", // Placeholder
      };
    });

    // 2. Para as erradas, busca as explicações da IA em paralelo
    const explanationPromises = resultDetails
      .filter(detail => !detail.isCorrect)
      .map((detail, index) => {
        // Encontra o texto das opções para dar mais contexto à IA
        const questionInfo = lastQuestions.find(q => q.question === detail.question);
        if (!questionInfo) return Promise.resolve("Contexto da pergunta não encontrado.");

        const userOptionIndex = detail.selected.charCodeAt(0) - 'A'.charCodeAt(0);
        const correctOptionIndex = detail.correct.charCodeAt(0) - 'A'.charCodeAt(0);

        const userAnswerText = questionInfo.options[userOptionIndex] || "Opção inválida";
        const correctAnswerText = questionInfo.options[correctOptionIndex] || "Opção inválida";

        return this.ollamaApi.generateExplanation(detail.question, userAnswerText, correctAnswerText);
      });

    const explanations = await Promise.all(explanationPromises);

    // 3. Adiciona as explicações geradas de volta nos detalhes dos resultados
    let explanationIndex = 0;
    resultDetails.forEach(detail => {
      if (!detail.isCorrect) {
        detail.explanation = explanations[explanationIndex++];
      }
    });

    // 4. Monta o objeto de resultado final
    const result: QuizResultData = {
      message: `Você acertou ${correctCount} de ${lastAnswerKeys.length}.`,
      totalCorrectAnswers: correctCount,
      totalWrongAnswers: lastAnswerKeys.length - correctCount,
      detalhes: resultDetails,
      subject: lastSubject || "Desconhecido",
      nivel: nivelAtual || "Desconhecido",
    };

    return result;
  }
}