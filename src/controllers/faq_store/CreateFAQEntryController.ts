import { Request, Response } from "express";
import { CreateFAQEntryService } from "../../services/faq_store/createFAQEntryService";

export class CreateFAQEntryController {
  async handle(req: Request, res: Response) {
    try {
      const { group_id, subject, nivel, questions, answer_keys } = req.body;
      const service = new CreateFAQEntryService();
      const result = await service.execute({ group_id, subject, nivel, questions, answer_keys });
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
