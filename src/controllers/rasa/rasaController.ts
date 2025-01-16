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
      return res.status(400).json({ error: "Sender and message are required." });
    }

    try {
      const responseFromRasa = await this.rasaService.sendMessageToSAEL({
        sender,
        message,
      });

      return res.json(responseFromRasa);
    } catch (error: any) {
      console.error("Error communicating with Rasa:", error.message || error);
      return res.status(error.statusCode || 500).json({
        error: error.message || "Error connecting to Rasa.",
      });
    }
  }
}

export { RasaController };
