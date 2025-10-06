import { Request, Response } from "express";
import { actionPerguntarService } from "../../../services/rasa/ActionChat/perguntarService";
import { UserAnalysis } from "@/models/UserAnalysis";
import { extractAllowedSubject } from "../../../utils/subjectExtractor";

export async function actionPerguntarController(req: Request, res: Response) {
  const { message } = req.body;
  const senderId = req.user?.id || "user";

  if (!message) {
    return res.status(400).json({ error: "Texto da mensagem é obrigatório." });
  }

  const subject = extractAllowedSubject(message);

  if (subject === null) {
    console.log(`[Gate] Mensagem bloqueada por não ser sobre lógica: "${message}"`);
    return res.status(200).json({
      responses: [{
        text: "Desculpe, só posso conversar sobre lógica de programação."
      }]
    });
  }

  console.log(`[Gate] Mensagem permitida. Assunto: '${subject}'.`);

  try {
    const response = await actionPerguntarService(message, senderId);

    const userAnalysis = await UserAnalysis.findOne({ userId: senderId });

    if (userAnalysis) {
      const lastSession = userAnalysis.sessions.at(-1);

      if (lastSession && !lastSession.sessionEnd) {
        userAnalysis.updateSubjectCountsChat(subject as any);
        await userAnalysis.save();
        console.log(`[UserAnalysis] Contagem de assunto '${subject}' atualizada para o chat.`);
      }
    }

    res.status(200).json(response);

  } catch (error: any) {
    console.error("Erro ao conversar com o assistente:", error);
    res.status(500).json({ message: "Erro ao conversar com o assistente", error: error.message });
  }
}