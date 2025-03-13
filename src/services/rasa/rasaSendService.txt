import axios from "axios";
import jwt from "jsonwebtoken";
import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";

interface RasaMessageRequest {
  sender: string;
  message: string;
  token: string;
}

class RasaSendService {
  private rasaUrl: string;

  constructor() {
    this.rasaUrl = process.env.RASA_URL || "http://localhost:5005/webhooks/rest/webhook";
  }

  async sendMessageToRasa({ sender, message, token }: RasaMessageRequest) {
    try {
      // decodificar o token JWT para obter informações do usuário
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
      const { id: userId, name, email, role, school, curso, turma } = decoded;

      // buscar sessão ativa do usuário ou criar uma nova
      let session = await UserAnalysis.findOne({ userId, endTime: null });

      if (!session) {
        session = new UserAnalysis({
          userId,
          startTime: new Date(),
          correctAnswers: 0,
          wrongAnswers: 0,
          totalQuestionsAnswered: 0,
          taxaDeAcertos: 0,
          taxaDeErros: 0,
          dispositivo: "Desconhecido",
          nivel: "Desconhecido",
          curso,
          turma,
          interactions: [],
          answerHistory: [],
          name,
          email,
          role,
          school,
        });

        await session.save();
      }

      // criar payload para enviar ao SAEL
      const payload = {
        sender,
        message,
        metadata: {
          nivel: session.level,
          curso: session.courses,
          turma: session.classes,
          dispositivo: session.dispositivo,
        },
      };

      console.log("Enviando mensagem para Rasa:", payload);

      // enviar mensagem para o Rasa
      const response = await axios.post(this.rasaUrl, payload);

      if (!response.data || response.data.length === 0) {
        throw new AppError("Nenhuma resposta do Rasa foi recebida.", 502);
      }

      // capturar respostas do bot
      const botResponses = response.data.map((res: any) => res.text).join(" ");

      // registrar interação no UserAnalysis
      session.interactions.push({
        timestamp: new Date(),
        message,
        botResponse: botResponses,
      });

      // verificar se houve uma pergunta com resposta
      for (const res of response.data) {
        if (res.custom?.question_id && res.custom?.correct_answer) {
          const { question_id, correct_answer } = res.custom;

          // simulando uma resposta do usuário (isso pode vir do frontend futuramente)
          const selectedOption = "opção_padrão";
          const isCorrect = selectedOption === correct_answer;

          session.answerHistory.push({
            question_id,
            selectedOption,
            isCorrect,
            timestamp: new Date(),
          });

          if (isCorrect) session.correctAnswers += 1;
          else session.wrongAnswers += 1;

          session.totalQuestionsAnswered = session.correctAnswers + session.wrongAnswers;
          session.taxaDeAcertos = (session.correctAnswers / session.totalQuestionsAnswered) * 100;
          session.taxaDeErros = (session.wrongAnswers / session.totalQuestionsAnswered) * 100;
        }
      }

      // salvar todas as mudanças no banco de dados
      await session.save();

      return response.data;
    } catch (error: any) {
      console.error("Erro no serviço Rasa:", error);
      throw new AppError(`Erro ao processar mensagem: ${error.message}`, 500);
    }
  }
}

export { RasaSendService };
