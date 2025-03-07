import { Request, Response } from "express";
import { startSessionService } from "../../services/userAnalysis/Analysis/startSessionService";

class StartSessionController {
  async handle(req: Request, res: Response) {
    try {
      const { dispositivo, name, email, role, school } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado." });
      }

      const metadata = {
        dispositivo: dispositivo || "desconhecido",
        name: name || user.name || "desconhecido",
        email: email || user.email || "desconhecido",
        role: role || user.role || [],
        school: school || user.school || "desconhecido"
      };

      const session = await startSessionService.execute(user.id, metadata);

      return res.json({ message: "Sessão iniciada com sucesso.", session });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { StartSessionController };
