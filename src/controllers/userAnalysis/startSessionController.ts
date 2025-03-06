import { Request, Response } from "express";
import { startSessionService } from "../../services/userAnalysis/Analysis/startSessionService";

class StartSessionController {
  async handle(req: Request, res: Response) {
    try {
      const { dispositivo } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado." });
      }

      const session = await startSessionService.execute(user.id, dispositivo || "desconhecido");
      return res.json({ message: "Sessão iniciada.", session });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { StartSessionController };
