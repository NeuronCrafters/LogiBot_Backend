import { Request, Response } from "express";
import { RasaGetHistoryService } from "../../services/rasa/rasaGetHistoryService";

class RasaGetHistoryController {
  private rasaGetHistoryService: RasaGetHistoryService;

  constructor() {
    this.rasaGetHistoryService = new RasaGetHistoryService();
  }

  async handle(req: Request, res: Response) {
    const { studentId } = req.query;

    try {
      const history = await this.rasaGetHistoryService.execute(studentId as string);
      return res.json(history);
    } catch (error: any) {
      console.error("Erro ao recuperar histórico:", error.message);
      return res.status(500).json({ error: "Erro ao recuperar histórico." });
    }
  }
}

export { RasaGetHistoryController };
