import { Request, Response } from "express";
import { setTaxaDeAcertosService } from "../../services/userAnalysis/Analysis/setTaxaDeAcertosService";

class SetTaxaDeAcertosController {
  async handle(req: Request, res: Response) {
    try {
      const { taxa } = req.body;
      const user = req.user;

      if (!user || taxa === undefined) {
        return res.status(400).json({ error: "Usuário ou taxa de acertos inválida." });
      }

      const session = await setTaxaDeAcertosService.execute(user.id, taxa);
      return res.json({ message: "Taxa de acertos registrada.", session });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { SetTaxaDeAcertosController };
