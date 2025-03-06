import { Request, Response } from "express";
import { RegisterUserAnswerService } from "../../services/userAnalysis/Analysis/registerUserAnswerService";

export class RegisterUserAnswerController {
  async handle(req: Request, res: Response) {
    try {
      const { userId, group_id, questionIndex, selectedOption } = req.body;

      const service = new RegisterUserAnswerService();
      const result = await service.execute({ userId, group_id, questionIndex, selectedOption });

      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
