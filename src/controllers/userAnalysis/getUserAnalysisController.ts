import { Request, Response } from "express";
import { getUserAnalysisService } from "../../services/userAnalysis/Analysis/getUserAnalysisService";

class GetUserAnalysisController {
  async handle(req: Request, res: Response) {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado." });
      }

      const sessionData = await getUserAnalysisService.execute(user.id);

      if (!sessionData) {
        return res.status(404).json({ error: "Nenhuma sessão ativa encontrada para este usuário." });
      }

      return res.json(sessionData);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { GetUserAnalysisController };
