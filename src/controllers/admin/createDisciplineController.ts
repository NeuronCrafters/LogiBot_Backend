import { Request, Response } from "express";
import { createDisciplineService } from "../../services/admin/createDisciplineService";

class createDisciplineController {
  async handle(req: Request, res: Response) {
    const { code, name, classIds } = req.body;
    const disciplineService = new createDisciplineService();

    const discipline = await disciplineService.create(code, name, classIds);
    return res.status(201).json(discipline);
  }

  async list(req: Request, res: Response) {
    const disciplineService = new createDisciplineService();

    const disciplines = await disciplineService.list();
    return res.status(200).json(disciplines);
  }
}

export { createDisciplineController };
