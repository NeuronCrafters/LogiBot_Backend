import { Request, Response } from "express";
import { createCourseService } from "../../services/University/createCourseService";

class createCourseController {
  async handle(req: Request, res: Response) {
    const { name, universityId } = req.body;
    const courseService = new createCourseService();

    const course = await courseService.create(name, universityId);
    return res.status(201).json(course);
  }

  async list(req: Request, res: Response) {
    const { universityId } = req.params;
    const courseService = new createCourseService();

    const courses = await courseService.listByUniversity(universityId);
    return res.status(200).json(courses);
  }
}

export { createCourseController };
