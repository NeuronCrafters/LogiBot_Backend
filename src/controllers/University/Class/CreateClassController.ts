import { Request, Response } from "express";
import { CreateClassService } from "../../../services/University/Class/CreateClassService";

class CreateClassController {
  async handle(req: Request, res: Response) {
    try {
      const { name, courseId } = req.body;
      const createClassService = new CreateClassService();

      const classData = await createClassService.execute(name, courseId);
      return res.status(201).json(classData);
    } catch (error: any) {

      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }
}

export { CreateClassController };
