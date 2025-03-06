import { Request, Response } from "express";
import { endSessionService } from "../../services/userAnalysis/Analysis/endSessionService";

class EndSessionController {
  async handle(req: Request, res: Response) {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado." });
      }

      const session = await endSessionService.execute(user.id);
      return res.json({ message: "Sessão finalizada.", session });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { EndSessionController };
