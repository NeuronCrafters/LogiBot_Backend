import { Request, Response } from "express";
import { actionPerguntarService } from "../../../services/rasa/ActionChat/perguntarService";
import { UserAnalysis } from "@/models/UserAnalysis";
import { validateAndEnrichPrompt } from "../../../utils/subjectExtractor";

export async function actionPerguntarController(req: Request, res: Response) {
  const { message } = req.body;
  const senderId = req.user?.id || "user";

  if (!message) {
    return res.status(400).json({ error: "Texto da mensagem é obrigatório." });
  }

  const validationResult = validateAndEnrichPrompt(message);

  if (!validationResult) {
    return res.status(200).json({
      responses: [{
        text: "Desculpe, só posso conversar sobre programação, algoritmos e tópicos relacionados. Pode me perguntar sobre variáveis, listas, ou até mesmo Docker!"
      }]
    });
  }

  const { subject, prompt, systemPrompt } = validationResult;

  try {
    const response = await actionPerguntarService(prompt, senderId, systemPrompt);

    const userAnalysis = await UserAnalysis.findOne({ userId: senderId });

    if (userAnalysis) {
      const lastSession = userAnalysis.sessions.at(-1);

      if (lastSession && !lastSession.sessionEnd) {
        userAnalysis.updateSubjectCountsChat(subject as any);

        const newCount = lastSession.subjectCountsChat[subject as any] || 1;

        await userAnalysis.save();



      }
    }

    res.status(200).json(response);

  } catch (error: any) {

    res.status(500).json({ message: "erro ao conversar com o assistente", error: error.message });
  }
}