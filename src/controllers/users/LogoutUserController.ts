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

      let userAnalysis = await UserAnalysis.findOne({ userId });

      if (!userAnalysis || userAnalysis.sessions.length === 0) {
        throw new AppError("Nenhuma sessão ativa encontrada para este usuário.", 404);
      }

      // atualizar a última sessão
      const lastSession = userAnalysis.sessions[userAnalysis.sessions.length - 1];
      lastSession.sessionEnd = new Date();
      lastSession.sessionDuration = (lastSession.sessionEnd.getTime() - lastSession.sessionStart.getTime()) / 1000;

      // calcular tempo total de uso do usuário
      const totalUsageTime = userAnalysis.sessions.reduce((acc, session) => {
        return acc + (session.sessionDuration || 0);
      }, 0);

      await userAnalysis.save();

      return res.status(200).json({
        message: "Sessão encerrada com sucesso.",
        sessionEnd: lastSession.sessionEnd,
        totalUsageTime,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export { LogoutUserController };
