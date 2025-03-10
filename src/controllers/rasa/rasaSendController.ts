import { Request, Response } from "express";
import { RasaSendService } from "../../services/rasa/rasaSendService";

class RasaSendController {
  private rasaSendService: RasaSendService;

  constructor() {
    this.rasaSendService = new RasaSendService();
  }

  async handle(req: Request, res: Response) {
    try {
      // capturar token do cabeçalho da requisição
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Token não fornecido" });
      }

      // capturar mensagem do corpo da requisição
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Mensagem não fornecida" });
      }

      // obter ID do usuário do token
      const sender = (req as any).user?.id;
      if (!sender) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      // enviar mensagem para o Rasa e armazenar no banco
      const response = await this.rasaSendService.sendMessageToRasa({ sender, message, token });

      return res.json(response);
    } catch (error: any) {
      console.error("Erro no controlador Rasa:", error);
      return res.status(500).json({ error: error.message });
    }
  }
}

export { RasaSendController };
