import { Request, Response } from "express";
import { ListUniversitiesService } from "../../../services/University/University/ListUniversitiesService";

class ListUniversitiesController {
  async handle(req: Request, res: Response) {
    try {
      const listUniversitiesService = new ListUniversitiesService();
      const universities = await listUniversitiesService.execute();

      return res.status(200).json(universities);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }
}

export { ListUniversitiesController };
