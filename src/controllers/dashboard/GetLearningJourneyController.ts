import { Request, Response } from 'express';
import { GetLearningJourneyService } from '../../services/dashboard/GetLearningJourneyService';

export class GetLearningJourneyController {
  public async handle(req: Request, res: Response): Promise<Response> {
    try {
      const { universityId, courseId, classId, studentId } = req.body;
      const service = new GetLearningJourneyService();
      const data = await service.execute({ universityId, courseId, classId, studentId });
      return res.status(200).json(data);
    } catch (error: any) {
      console.error(`[getlearningjourneycontroller] error: ${error.message}`);
      return res.status(500).json({ message: "Erro ao buscar dados da jornada de aprendizagem." });
    }
  }
}