import { AppError } from "../../../exceptions/AppError";
import { QuizResultData } from "../types/QuizResultData";

class RasaVerificationService {
  async verificarRespostasComRasa(_userId?: string, _respostas?: string[]): Promise<QuizResultData> {
    throw new AppError("verificacao via Rasa foi removida.", 410);
  }

  async testarConexaoRasa(): Promise<boolean> {
    return false;
  }
}

export { RasaVerificationService };
