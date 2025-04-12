import { Request, Response } from "express";
import { AuthUserService } from "../../services/users/AuthUserService";

class AuthUserController {
  async handle(req: Request, res: Response) {
    const { email, password } = req.body;

    const authUserService = new AuthUserService();
    const result = await authUserService.signin({ email, password });

    const { token, ...userData } = result;

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    });

    return res.json(userData);
  }

  async logout(req: Request, res: Response) {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId é obrigatório para logout." });
    }

    const authUserService = new AuthUserService();
    await authUserService.logout(userId);

    res.clearCookie("token");

    return res.json({ message: "Sessão encerrada com sucesso." });
  }
}

export { AuthUserController };
