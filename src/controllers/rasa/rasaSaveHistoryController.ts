import { Request, Response } from "express";
import { RasaSaveHistoryService } from "../../services/rasa/rasaSaveHistoryService";

class RasaSaveHistoryController {
  private rasaSaveHistoryService: RasaSaveHistoryService;

  constructor() {
    this.rasaSaveHistoryService = new RasaSaveHistoryService();
  }

  async handle(req: Request, res: Response) {
    const { studentId, messages, metadata, startTime, endTime } = req.body;

    if (!studentId || !messages || !startTime || !endTime) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    try {
      const history = await this.rasaSaveHistoryService.execute({
        studentId,
        messages,
        metadata,
        startTime,
        endTime,
      });

      return res.status(201).json(history);
    } catch (error: any) {
      console.error("Erro ao salvar histórico:", error.message);
      return res.status(500).json({ error: "Erro ao salvar histórico." });
    }
  }
}

export { RasaSaveHistoryController };
