import { Request, Response } from "express";
import { RasaGetHistoryService } from "../../services/rasa/rasaGetHistoryService";

class RasaGetHistoryController {
  private rasaGetHistoryService: RasaGetHistoryService;

  constructor() {
    this.rasaGetHistoryService = new RasaGetHistoryService();
  }

  async handle(req: Request, res: Response) {
    const { studentId, classId } = req.query;
    const user = req.user;

    console.log("Requisição recebida com os parâmetros:", { studentId, classId });
    console.log("Usuário autenticado:", user);

    try {
      const history = await this.rasaGetHistoryService.execute(
        { studentId: studentId as string, classId: classId as string },
        user
      );

      console.log("Histórico recuperado:", history);
      return res.json(history);
    } catch (error: any) {
      console.error("Erro ao recuperar histórico:", error.message);
      return res.status(403).json({ error: error.message || "Erro ao recuperar histórico." });
    }
  }
}

export { RasaGetHistoryController };
