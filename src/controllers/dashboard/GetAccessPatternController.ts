import { Request, Response } from 'express';
import { GetAccessPatternService } from '../../services/dashboard/GetAccessPatternService';

export class GetAccessPatternController {
  public async handle(req: Request, res: Response): Promise<Response> {
    try {
      const { universityId, courseId, classId, studentId } = req.body;
      const service = new GetAccessPatternService();
      const data = await service.execute({ universityId, courseId, classId, studentId });
      return res.status(200).json(data);
    } catch (error: any) {

      return res.status(500).json({ message: "Erro ao buscar padrões de acesso." });
    }
  }
}