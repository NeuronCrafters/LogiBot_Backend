import { Request, Response } from "express";
import { RasaService } from "../../services/rasa/rasaService";

class RasaController {
  private rasaService: RasaService;

  constructor() {
    this.rasaService = new RasaService();
  }

  async handle(req: Request, res: Response) {
    const { sender, message } = req.body;

    if (!sender || !message) {
      return res.status(400).json({ error: "Sender e message são obrigatórios." });
    }

    try {
      const responseFromRasa = await this.rasaService.sendMessageToSAEL({
        sender,
        message,
      });

      return res.json(responseFromRasa);
    } catch (error: any) {
      console.error("Errona comunicação com o Rasa:", error.message || error);
      return res.status(error.statusCode || 500).json({
        error: error.message || "Error na conexão com o Rasa.",
      });
    }
  }
}

export { RasaController };
