import { Request, Response } from "express";
import { RasaSendService } from "../../services/rasa/rasaSendService";
import { AppError } from "../../exceptions/AppError";

class RasaSendController {
  private rasaSendService: RasaSendService;

  constructor() {
    this.rasaSendService = new RasaSendService();
  }

  async handle(req: Request, res: Response) {
    try {
      const { message } = req.body;
      const user = req.user;

      if (!message) {
        throw new AppError("A mensagem é obrigatória.", 400);
      }

      if (!user || !user.id) {
        throw new AppError("Usuário não autenticado.", 401);
      }

      const metadata = {
        email: user.email || "desconhecido",
        role: user.role || "desconhecido",
        name: user.name || "desconhecido",
      };

      const responseFromRasa = await this.rasaSendService.sendMessageToSAEL({
        sender: user.id,
        message,
        metadata,
      });

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