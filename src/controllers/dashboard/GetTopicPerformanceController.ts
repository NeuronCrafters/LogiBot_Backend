import { Request, Response } from 'express';
import { GetTopicPerformanceService } from '../../services/dashboard/GetTopicPerformanceService';

export class GetTopicPerformanceController {
  public async handle(req: Request, res: Response): Promise<Response> {
    try {
      const { universityId, courseId, classId, studentId } = req.body;
      const getTopicPerformanceService = new GetTopicPerformanceService();
      const data = await getTopicPerformanceService.execute({ universityId, courseId, classId, studentId });
      return res.status(200).json(data);
    } catch (error: any) {
      console.error(`[GetTopicPerformanceController] Error: ${error.message}`);
      return res.status(500).json({ message: "Erro ao buscar dados de desempenho por tópico." });
    }
  }
}