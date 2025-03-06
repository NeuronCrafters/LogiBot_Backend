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
      const { message, dispositivo } = req.body;
      const user = req.user;

      // validação dos dados de entrada
      if (!message) {
        throw new AppError("A mensagem é obrigatória.", 400);
      }

      if (!user || !user.id) {
        throw new AppError("Usuário não autenticado.", 401);
      }

      // atualizar sessão do usuário para análise 
      await userAnalysisManager.startSession(user.id, dispositivo || "desconhecido");

      // registrar interação do usuário
      await userAnalysisManager.addInteraction(user.id, message);

      // metadados do usuário
      const metadata = {
        email: user.email || "desconhecido",
        role: user.role || "desconhecido",
        name: user.name || "desconhecido",
      };

      // enviar mensagem ao sael e obter resposta
      const responseFromRasa = await this.rasaSendService.sendMessageToSAEL({
        sender: user.id,
        message,
        metadata,
      });

      // responder com a resposta do sael
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
