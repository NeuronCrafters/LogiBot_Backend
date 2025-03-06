import { Request, Response } from "express";
import { addInteracaoForaDaSalaService } from "../../services/userAnalysis/Analysis/addInteracaoForaDaSalaService";

class AddInteracaoForaDaSalaController {
  async handle(req: Request, res: Response) {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado." });
      }

      const session = await addInteracaoForaDaSalaService.execute(user.id);
      return res.json({ message: "Interação fora da sala registrada.", session });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { AddInteracaoForaDaSalaController };
