import { startSessionService } from "../../services/userAnalysis/Analysis/startSessionService";
import { endSessionService } from "../../services/userAnalysis/Analysis/endSessionService";
import { addInteractionService } from "../../services/userAnalysis/Analysis/addInteractionService";
import { setTaxaDeAcertosService } from "../../services/userAnalysis/Analysis/setTaxaDeAcertosService";
import { addInteracaoForaDaSalaService } from "../../services/userAnalysis/Analysis/addInteracaoForaDaSalaService";
import { getUserAnalysisService } from "../../services/userAnalysis/Analysis/getUserAnalysisService";

class UserAnalysisManager {
  async startSession(userId: string, dispositivo: string) {
    return await startSessionService.execute(userId, dispositivo);
  }

  async endSession(userId: string) {
    return await endSessionService.execute(userId);
  }

  async addInteraction(userId: string, message: string, isOutOfScope: boolean = false) {
    return await addInteractionService.execute(userId, message, isOutOfScope);
  }

  async setTaxaDeAcertos(userId: string, taxa: number) {
    return await setTaxaDeAcertosService.execute(userId, taxa);
  }

  async addInteracaoForaDaSala(userId: string) {
    return await addInteracaoForaDaSalaService.execute(userId);
  }

  async getUserAnalysis(userId: string) {
    return await getUserAnalysisService.execute(userId);
  }
}

export const userAnalysisManager = new UserAnalysisManager();
