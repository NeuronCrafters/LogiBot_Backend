import { Request, Response } from "express";
import { setTaxaDeAcertosService } from "../../services/userAnalysis/Analysis/setTaxaDeAcertosService";

class SetTaxaDeAcertosController {
  async handle(req: Request, res: Response) {
    try {
      const { correctAnswers, wrongAnswers } = req.body;
      const user = req.user;

      if (!user || correctAnswers === undefined || wrongAnswers === undefined) {
        return res.status(400).json({
          error: "Usuário não autenticado ou dados insuficientes (correctAnswers, wrongAnswers)."
        });
      }

      const session = await setTaxaDeAcertosService.execute(user.id, correctAnswers, wrongAnswers);

      return res.json({ message: "Taxa de acertos registrada.", session });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { SetTaxaDeAcertosController };
