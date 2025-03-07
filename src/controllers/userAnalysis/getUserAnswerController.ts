import { Request, Response } from "express";
import { GetUserAnswerService } from "../../services/userAnalysis/Analysis/getUserAnswerService";

export class GetUserAnswerController {
  async handle(req: Request, res: Response) {
    try {
      const { userId, question_id } = req.body;

      if (!userId || !question_id) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes." });
      }

      const service = new GetUserAnswerService();
      const result = await service.execute({ userId, question_id });

      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
