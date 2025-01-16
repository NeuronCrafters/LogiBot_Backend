import { Request, Response } from "express";
import { RasaSendService } from "../../services/rasa/rasaSendService";

class RasaSendController {
  private rasaSendService: RasaSendService;

  constructor() {
    this.rasaSendService = new RasaSendService();
  }

  async handle(req: Request, res: Response) {
    const { message } = req.body;
    const user = req.user;

    if (!message || !user) {
      return res.status(400).json({ error: "Mensagem e informações do usuário são obrigatórias." });
    }

    try {
      const responseFromRasa = await this.rasaSendService.sendMessageToSAEL({
        sender: user.id,
        message,
        metadata: {
          email: user.email,
          role: user.role,
          name: user.name,
        },
      });

      return res.json(responseFromRasa);
    } catch (error: any) {
      console.error("Erro no controlador Rasa:", error.message || error);
      return res.status(error.statusCode || 500).json({
        error: error.message || "Erro ao processar a mensagem no Rasa.",
      });
    }
  }
}

export { RasaSendController };
