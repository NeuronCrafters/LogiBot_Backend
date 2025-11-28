import { Request, Response } from 'express';
import { GetEffortMatrixService } from '../../services/dashboard/GetEffortMatrixService';

export class GetEffortMatrixController {
  public async handle(req: Request, res: Response): Promise<Response> {
    try {
      const { universityId, courseId, classId, studentId } = req.body;
      const getEffortMatrixService = new GetEffortMatrixService();
      const data = await getEffortMatrixService.execute({ universityId, courseId, classId, studentId });
      return res.status(200).json(data);
    } catch (error: any) {

      return res.status(500).json({ message: "Erro ao buscar dados da matriz de esforço." });
    }
  }
}