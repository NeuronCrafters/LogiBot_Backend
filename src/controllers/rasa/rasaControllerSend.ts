import { Request, Response } from "express";
import { rasaServiceSend } from "../../services/rasa/rasaServiceSend"
import { UserAnalysis } from "../../models/UserAnalysis";

class RasaControllerSend {
  async handle(req: Request, res: Response) {
    try {
      const { message, sender } = req.body;

      if (!message || !sender) {
        return res.status(400).json({ error: "O 'message' e 'sender' são obrigatórios." });
      }

      const response = await rasaServiceSend(message, sender);

      // Buscar a sessão ativa do usuário
      let userSession = await UserAnalysis.findOne({ userId: sender }).sort({ sessionStart: -1 });

      if (!userSession) {
        userSession = new UserAnalysis({
          userId: sender,
          sessionStart: new Date(),
        });
      }

      userSession.interactions.push({
        timestamp: new Date(),
        message,
        botResponse: response.length ? response[0].text : "",
      });

      await userSession.save();

      return res.json(response);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { RasaControllerSend };
