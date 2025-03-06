import { Request, Response } from "express";
import { CreateDisciplineService } from "../../../services/University/Discipline/CreateDisciplineService";

class CreateDisciplineController {
  async handle(req: Request, res: Response) {
    try {
      const { name, courseId, classIds, professorIds } = req.body;

      if (!name || !courseId || !classIds) {
        return res
          .status(400)
          .json({ message: "Os campos 'name', 'courseId' e 'classIds' são obrigatórios!" });
      }

      const createDisciplineService = new CreateDisciplineService();
      const discipline = await createDisciplineService.execute(name, courseId, classIds, professorIds || []);

      return res.status(201).json(discipline);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }
}

export { CreateDisciplineController };
