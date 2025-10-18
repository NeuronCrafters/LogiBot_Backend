import { Request, Response } from 'express';
import { GetSessionDetailsService } from '../../services/dashboard/GetSessionDetailsService';

export class GetSessionDetailsController {
  public async handle(req: Request, res: Response): Promise<Response> {
    try {
      const { universityId, courseId, classId, studentId, startDate, endDate } = req.body;

      const service = new GetSessionDetailsService();

      const data = await service.execute({ universityId, courseId, classId, studentId, startDate, endDate });

      return res.status(200).json(data);
    } catch (error: any) {
      console.error(`[GetSessionDetailsController] Error: ${error.message}`);
      return res.status(500).json({ message: "Erro ao buscar detalhes das sessões." });
    }
  }
}