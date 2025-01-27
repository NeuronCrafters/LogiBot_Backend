import { Request, Response } from "express";
import { createClassService } from "../../services/admin/createClassService";

class createClassController {
  async handle(req: Request, res: Response) {
    const { name, courseId } = req.body;
    const classService = new createClassService();

    const classData = await classService.create(name, courseId);
    return res.status(201).json(classData);
  }

  async list(req: Request, res: Response) {
    const { courseId } = req.params;
    const classService = new createClassService();

    const classes = await classService.listByCourse(courseId);
    return res.status(200).json(classes);
  }
}

export { createClassController };
