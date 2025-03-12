import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";

class LogoutUserController {
  async handle(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        throw new AppError("Token não fornecido.", 401);
      }

      const token = authHeader.split(" ")[1];

      if (!token) {
        throw new AppError("Token inválido.", 401);
      }

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

      if (!decoded || !decoded.sub) {
        throw new AppError("Token inválido.", 401);
      }

      const userId = decoded.sub;

      let userSession = await UserAnalysis.findOne({ userId }).sort({ sessionStart: -1 });

      if (!userSession) {
        throw new AppError("Nenhuma sessão ativa encontrada para este usuário.", 404);
      }

      userSession.sessionEnd = new Date();
      userSession.sessionDuration = (userSession.sessionEnd.getTime() - userSession.sessionStart.getTime()) / 1000;

      await userSession.save();

      return res.status(200).json({ message: "Sessão encerrada com sucesso.", sessionEnd: userSession.sessionEnd });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export { LogoutUserController };
