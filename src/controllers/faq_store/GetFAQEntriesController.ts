import { Request, Response } from "express";
import { GetFAQEntriesService } from "../../services/faq_store/getFAQEntriesService";

export class GetFAQEntriesController {
  async handle(req: Request, res: Response) {
    try {
      const service = new GetFAQEntriesService();
      const faqs = await service.execute();
      return res.json(faqs);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
