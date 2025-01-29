import { Request, Response } from "express";
import { CreateUniversityService } from "../../../services/University/University/CreateUniversityService";

class CreateUniversityController {
  async handle(req: Request, res: Response) {
    try {
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ message: "O nome da universidade é obrigatório!" });
      }

      const createUniversityService = new CreateUniversityService();
      const university = await createUniversityService.execute(name);

      return res.status(201).json(university);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }
}

export { CreateUniversityController };
