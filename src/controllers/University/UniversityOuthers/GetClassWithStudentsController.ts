import { Request, Response } from "express";
import { GetClassWithStudentsService } from "../../../services/University/UniversityOuthers/GetClassWithStudentsService"

class GetClassWithStudentsController {
  async handle(req: Request, res: Response): Promise<Response> {
    const { classId } = req.params;

    try {
      const getClassWithStudentsService = new GetClassWithStudentsService();
      const classWithStudents = await getClassWithStudentsService.execute(classId);

      return res.status(200).json(classWithStudents);
    } catch (error: any) {
      console.error("Erro ao buscar turma e alunos:", error.message);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro interno no servidor.",
      });
    }
  }
}

export { GetClassWithStudentsController };
