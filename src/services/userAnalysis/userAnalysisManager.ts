import { startSessionService } from "./Analysis/startSessionService";
import { endSessionService } from "./Analysis/endSessionService";
import { addInteractionService } from "./Analysis/addInteractionService";
import { setTaxaDeAcertosService } from "./Analysis/setTaxaDeAcertosService";
import { addInteracaoForaDaSalaService } from "./Analysis/addInteracaoForaDaSalaService";
import { getUserAnalysisService } from "./Analysis/getUserAnalysisService";
import { GetUserAnswerService } from "./Analysis/getUserAnswerService";
import { RegisterUserAnswerService } from "./Analysis/registerUserAnswerService";

interface SessionMetadata {
  dispositivo: string;
  name: string;
  email: string;
  role: string[];
  school: string;
}

class UserAnalysisManager {
  async startSession(userId: string, metadata: SessionMetadata) {
    return await startSessionService.execute(userId, metadata);
  }

  async endSession(userId: string) {
    return await endSessionService.execute(userId);
  }

  async addInteraction(userId: string, message: string, isOutOfScope: boolean = false) {
    return await addInteractionService.execute(userId, message, isOutOfScope);
  }

  async updateUserAccuracy(userId: string, correctAnswers: number, wrongAnswers: number) {
    return await setTaxaDeAcertosService.execute(userId, correctAnswers, wrongAnswers);
  }

  async addInteracaoForaDaSala(userId: string) {
    return await addInteracaoForaDaSalaService.execute(userId);
  }

  async getUserAnalysis(userId: string) {
    return await getUserAnalysisService.execute(userId);
  }

  async getUserAnswer(userId: string, question_id: string) {
    return await new GetUserAnswerService().execute({ userId, question_id });
  }

  async registerUserAnswer(userId: string, group_id: string, question_id: string, selectedOption: string) {
    return await new RegisterUserAnswerService().execute({ userId, group_id, question_id, selectedOption });
  }
}

export const userAnalysisManager = new UserAnalysisManager();
