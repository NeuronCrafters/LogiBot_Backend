import { Request, Response } from "express";
import { rasaSendService } from "../../services/rasa/rasaSendService";
import { UserAnalysis } from "../../models/UserAnalysis";
import jwt from "jsonwebtoken";
import { AppError } from "../../exceptions/AppError";
import { normalizeText } from "../../utils/normalizeText";

class RasaSendController {
  async handle(req: Request, res: Response): Promise<Response<any, Record<string, any>>> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new AppError("Token não fornecido.", 401);
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        throw new AppError("Token inválido.", 401);
      }

      let userId: string;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id?: string };
        if (!decoded.id) {
          throw new AppError("Token inválido ou expirado.", 401);
        }
        userId = decoded.id;
      } catch (error) {
        throw new AppError("Token inválido ou expirado.", 401);
      }

      console.log(`[DEBUG] Usuário autenticado: ${userId}`);

      // recebe a mensagem original
      const { message } = req.body;
      if (!message) {
        throw new AppError("O campo 'message' é obrigatório.", 400);
      }

      // normaliza a mensagem
      const normalizedMessage = normalizeText(message);

      console.log(`[DEBUG] Enviando mensagem normalizada para Rasa: ${normalizedMessage}`);

      // Usa a mensagem normalize na chamada do serviço
      const response: any = await rasaSendService(normalizedMessage, userId);
      console.log(`[DEBUG] Resposta do Rasa recebida: ${JSON.stringify(response)}`);

      const userAnalysis = await UserAnalysis.findOne({ userId });

      if (!userAnalysis || userAnalysis.sessions.length === 0) {
        throw new AppError("Nenhuma sessão ativa encontrada para este usuário.", 404);
      }

      const lastSession = userAnalysis.sessions[userAnalysis.sessions.length - 1];

      if (lastSession.sessionEnd) {
        throw new AppError("A sessão do usuário já foi encerrada.", 400);
      }

      lastSession.answerHistory.push({
        questions: [],
        totalCorrectWrongAnswersSession: {
          totalCorrectAnswers: 0,
          totalWrongAnswers: 0,
        },
      });

      await userAnalysis.save();

      console.log(`[UserAnalysis] Interação registrada para usuário: ${userId}`);

      return res.json(response);
    } catch (error: any) {
      console.error("[RasaControllerSend] Erro ao processar interação:", error);
      return res.status(error.statusCode || 500).json({ error: error.message || "Erro interno no servidor." });
    }
  }
}

export { RasaSendController };