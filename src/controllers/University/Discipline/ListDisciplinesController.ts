import { Request, Response } from "express";
import { ListDisciplinesService } from "../../../services/University/Discipline/ListDisciplinesService";

class ListDisciplinesController {
  async handle(req: Request, res: Response) {
    try {
      const listDisciplinesService = new ListDisciplinesService();
      const disciplines = await listDisciplinesService.execute();

      return res.status(200).json(disciplines);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }
}

export { ListDisciplinesController };
