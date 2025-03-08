import { Request, Response } from "express";
import { RasaSendService } from "../../services/rasa/rasaSendService";
import { userAnalysisManager } from "../../services/userAnalysis/userAnalysisManager";
import { AppError } from "../../exceptions/AppError";

class RasaSendController {
  private rasaSendService: RasaSendService;

  constructor() {
    this.rasaSendService = new RasaSendService();
  }

  async handle(req: Request, res: Response) {
    try {
      const { message, dispositivo, nivel, categoria, pergunta } = req.body;
      const user = req.user;

      if (!message) {
        throw new AppError("A mensagem é obrigatória.", 400);
      }

      if (!user || !user.id) {
        throw new AppError("Usuário não autenticado.", 401);
      }

      const sessionMetadata = {
        dispositivo: dispositivo || "desconhecido",
        email: user.email || "desconhecido",
        name: user.name || "desconhecido",
        role: Array.isArray(user.role) ? user.role : [],
        school: user.school || "desconhecido",
        nivel: nivel || "desconhecido",
        categoria: req.body.categoria || null,
        pergunta: req.body.pergunta || null,
      };

      // Inicializa sessão e registra interação
      await userAnalysisManager.startSession(user.id, sessionMetadata);
      await userAnalysisManager.addInteraction(user.id, message);

      // Envia mensagem ao Rasa com slots necessários já preenchidos
      const responseFromRasa = await this.rasaSendService.sendMessageToSAEL({
        sender: user.id,
        message,
        metadata: sessionMetadata,
      });

      // Caso mensagem indique finalização, encerra sessão
      if (message.toLowerCase().includes("finalizar")) {
        await userAnalysisManager.endSession(user.id);
      }

      return res.json(responseFromRasa);
    } catch (error: any) {
      console.error("Erro no controlador Rasa:", error);

      return res.status(error.statusCode || 500).json({
        error: error.message || "Erro ao processar a mensagem no Rasa.",
      });
    }
  }
}

export { RasaSendController };
