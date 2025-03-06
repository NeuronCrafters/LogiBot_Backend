import { Request, Response } from "express";
import { addInteractionService } from "../../services/userAnalysis/Analysis/addInteractionService";

class AddInteractionController {
  async handle(req: Request, res: Response) {
    try {
      const { message, isOutOfScope } = req.body;
      const user = req.user;

      if (!user || !message) {
        return res.status(400).json({ error: "Usuário ou mensagem inválida." });
      }

      const session = await addInteractionService.execute(user.id, message, isOutOfScope);
      return res.json({ message: "Interação registrada.", session });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { AddInteractionController };
