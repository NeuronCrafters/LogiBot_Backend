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
      return res.status(400).json({ error: "Sender and message are required" });
    }

    try {
      const responseFromRasa = await this.rasaService.sendMessageToSAEL({
        sender,
        message,
      });

      return res.json(responseFromRasa);
    } catch (error) {
      return res.status(500).json({ error: "Error connecting to Rasa" });
    }
  }
}

export { RasaController };
