import { Request, Response } from "express";
import { AuthUserService } from "../../services/users/AuthUserService";
import { AppError } from "../../exceptions/AppError";
import { verifyRecaptcha } from "../../utils/recaptcha";

class AuthUserController {
  async handle(req: Request, res: Response) {
    try {
      console.log("Requisição recebida no backend - corpo:", {
        email: req.body.email,
        hasPassword: !!req.body.password,
        hasGoogleId: !!req.body.googleId,
        hasRecaptchaToken: !!req.body.recaptchaToken
      });

      const { email, password, googleId, recaptchaToken } = req.body;

      // Valida reCAPTCHA apenas para login tradicional (não social)
      if (!googleId) {
        await verifyRecaptcha(recaptchaToken);
      }

      // Executa o login
      const authUserService = new AuthUserService();
      const result = await authUserService.signin({ email, password, googleId });

      const { token, ...userData } = result;

      // Define o cookie com o token
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24, // 1 dia
      });

      return res.json({
        success: true,
        user: userData,
        message: "Login realizado com sucesso!"
      });

    } catch (error: any) {
      if (error instanceof AppError) {
        console.error("AppError no AuthUserController:", error.message, error.statusCode);
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      console.error("Erro inesperado no AuthUserController:", error);
      return res.status(500).json({
        success: false,
        message: "Erro interno no servidor.",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "ID do usuário não encontrado na sessão."
        });
      }

      const authUserService = new AuthUserService();
      await authUserService.logout(userId);

      res.clearCookie("token");

      return res.json({
        success: true,
        message: "Sessão encerrada com sucesso."
      });

    } catch (error: any) {
      console.error("Erro no logout do AuthUserController:", error);
      return res.status(500).json({
        success: false,
        message: "Erro interno ao encerrar sessão.",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  }
}

export { AuthUserController };