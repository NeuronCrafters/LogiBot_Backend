import { Request, Response } from 'express';
import { GetProficiencyRadarService } from '../../services/dashboard/GetProficiencyRadarService';

export class GetProficiencyRadarController {
  public async handle(req: Request, res: Response): Promise<Response> {
    try {
      const { universityId, courseId, classId, studentId } = req.body;
      const service = new GetProficiencyRadarService();
      const data = await service.execute({ universityId, courseId, classId, studentId });
      return res.status(200).json(data);
    } catch (error: any) {
      console.error(`[getproficiencyradarcontroller] error: ${error.message}`);
      return res.status(500).json({ message: "Erro ao buscar dados do radar de proficiência." });
    }
  }
}