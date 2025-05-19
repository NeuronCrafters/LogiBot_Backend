import { Request, Response } from "express";
import { AuthUserService } from "../../services/users/AuthUserService";
import { AppError } from "../../exceptions/AppError";

class AuthUserController {
  async handle(req: Request, res: Response) {
    try {
      const { email, password, googleId } = req.body;
      const authUserService = new AuthUserService();
      const result = await authUserService.signin({ email, password, googleId });

      const { token, ...userData } = result;

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24, // 1 dia
      });

      return res.json(userData);
    } catch (error: any) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Erro no AuthUserController:", error);
      return res.status(500).json({
        message: "Erro interno no servidor.",
        error: error.message,
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId é obrigatório para logout." });
      }

      const authUserService = new AuthUserService();
      await authUserService.logout(userId);

      res.clearCookie("token");
      return res.json({ message: "Sessão encerrada com sucesso." });
    } catch (error: any) {
      console.error("Erro no logout do AuthUserController:", error);
      return res.status(500).json({
        message: "Erro interno ao encerrar sessão.",
        error: error.message,
      });
    }
  }
}

export { AuthUserController };
