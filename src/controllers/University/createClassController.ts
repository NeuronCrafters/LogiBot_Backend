import { Request, Response } from "express";
import { createClassService } from "../../services/University/createClassService";

class createClassController {
  async handle(req: Request, res: Response) {
    try {
      const { name, courseId } = req.body;
      const classService = new createClassService();

      const classData = await classService.create(name, courseId);
      return res.status(201).json(classData);
    } catch (error: any) {
      console.error("Erro ao criar turma:", error.message);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const { courseId } = req.params;
      const classService = new createClassService();

      const classes = await classService.listByCourse(courseId);
      return res.status(200).json(classes);
    } catch (error: any) {
      console.error("Erro ao listar turmas:", error.message);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { classId } = req.params;
      const classService = new createClassService();

      const result = await classService.delete(classId);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("Erro ao remover turma:", error.message);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }
}

export { createClassController };
