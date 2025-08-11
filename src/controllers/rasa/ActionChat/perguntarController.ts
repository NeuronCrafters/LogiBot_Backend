import { Request, Response } from "express";
import { actionPerguntarService } from "../../../services/rasa/ActionChat/perguntarService";
import { UserAnalysis } from "@/models/UserAnalysis";
import { normalizeSubjectFromMessage } from "../../../utils/normalizeSubject";

export async function actionPerguntarController(req: Request, res: Response) {
  const { message } = req.body;
  const senderId = req.user?.id || "user";

  if (!message) {
    return res.status(400).json({ error: "Texto da mensagem é obrigatório." });
  }

  try {
    const response = await actionPerguntarService(message, senderId);

    const userAnalysis = await UserAnalysis.findOne({ userId: senderId });

    if (userAnalysis) {
      const lastSession = userAnalysis.sessions.at(-1);

      if (lastSession && !lastSession.sessionEnd) {

        const subject = normalizeSubjectFromMessage(message);
        if (subject) {
          userAnalysis.updateSubjectCountsChat(subject);

          await userAnalysis.save();

          console.log(`[UserAnalysis] Contagem de assunto '${subject}' atualizada para o chat.`);
        } else {
          console.log(`[UserAnalysis] Nenhum assunto específico identificado na mensagem: "${message}"`);
        }
      }
    }
    res.status(200).json(response);

  } catch (error: any) {
    console.error("Erro ao conversar com o assistente:", error);
    res.status(500).json({ message: "Erro ao conversar com o assistente", error: error.message });
  }
}