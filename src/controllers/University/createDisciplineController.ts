import { Request, Response } from "express";
import { createDisciplineService } from "../../services/University/createDisciplineService";

class createDisciplineController {
  async handle(req: Request, res: Response) {
    try {
      const { name, courseId, classIds, professorIds } = req.body;

      if (!name || !courseId || !classIds) {
        return res
          .status(400)
          .json({ message: "Os campos 'name', 'courseId' e 'classIds' são obrigatórios!" });
      }

      const disciplineService = new createDisciplineService();
      const discipline = await disciplineService.create(name, courseId, classIds, professorIds || []);

      return res.status(201).json(discipline);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const disciplineService = new createDisciplineService();
      const disciplines = await disciplineService.list();

      return res.status(200).json(disciplines);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { disciplineId } = req.params;

      const disciplineService = new createDisciplineService();
      const result = await disciplineService.delete(disciplineId);

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }
}

export { createDisciplineController };
