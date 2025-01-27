import { Request, Response } from "express";
import { UniversityService } from "../../services/admin/createUniversityService";

class UniversityController {
  async handle(req: Request, res: Response) {
    const { name } = req.body;
    const universityService = new UniversityService();

    const university = await universityService.create(name);
    return res.status(201).json(university);
  }

  async list(req: Request, res: Response) {
    const universityService = new UniversityService();
    const universities = await universityService.list();
    return res.status(200).json(universities);
  }
}

export { UniversityController };
