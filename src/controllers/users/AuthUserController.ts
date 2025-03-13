import { Request, Response } from "express";
import { AuthUserService } from "../../services/users/AuthUserService";

class AuthUserController {
  async handle(req: Request, res: Response) {
    const { email, password } = req.body;

    const authUserService = new AuthUserService();
    const result = await authUserService.signin({ email, password });

    return res.json(result);
  }

  async logout(req: Request, res: Response) {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId é obrigatório para logout." });
    }

    const authUserService = new AuthUserService();
    await authUserService.logout(userId);

    return res.json({ message: "Sessão encerrada com sucesso." });
  }
}

export { AuthUserController };
