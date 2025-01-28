import { Request, Response } from "express";
import { createUniversityService } from "../../services/University/createUniversityService";

class CreateUniversityController {
  async handle(req: Request, res: Response) {
    const { name } = req.body;
    const universityService = new createUniversityService();

    const university = await universityService.create(name);
    return res.status(201).json(university);
  }

  async list(req: Request, res: Response) {
    const universityService = new createUniversityService();
    const universities = await universityService.list();
    return res.status(200).json(universities);
  }

  async deleteCourse(req: Request, res: Response) {
    const { courseId } = req.params;
    const universityService = new createUniversityService();

    const result = await universityService.deleteCourse(courseId);
    return res.status(200).json(result);
  }
}

export { CreateUniversityController };
