import { UserAnalysis } from "../../../models/UserAnalysis";

interface SessionMetadata {
  dispositivo: string;
  name: string;
  email: string;
  role: string[];
  school: string;
}

class StartSessionService {
  async execute(userId: string, metadata: SessionMetadata) {
    try {
      const existingSession = await UserAnalysis.findOne({ userId, endTime: null });

      if (!existingSession) {
        const newSession = new UserAnalysis({
          userId,
          startTime: new Date(),
          correctAnswers: 0,
          wrongAnswers: 0,
          totalQuestionsAnswered: 0,
          taxaDeAcertos: 0,
          taxaDeErros: 0,
          dispositivo: metadata.dispositivo,
          interactions: [],
        });

        await newSession.save();
        return newSession;
      }

      return existingSession;
    } catch (error) {
      throw new Error(`Erro ao iniciar sessão: ${error.message}`);
    }
  }
}

export const startSessionService = new StartSessionService();
