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

  const { subject, prompt } = validationResult;

  try {
    const response = await actionPerguntarService(prompt, senderId);

    const userAnalysis = await UserAnalysis.findOne({ userId: senderId });

    if (userAnalysis) {
      const lastSession = userAnalysis.sessions.at(-1);

      if (lastSession && !lastSession.sessionEnd) {
        userAnalysis.updateSubjectCountsChat(subject as any);

        const newCount = lastSession.subjectCountsChat[subject as any] || 1;

        await userAnalysis.save();

        console.log(`[UserAnalysis] ✅ Contagem salva com sucesso para o usuário: ${senderId}`);
        console.log(`[UserAnalysis] ➡️ Tópico: '${subject}' | Novo total: ${newCount}`);
      }
    }

    res.status(200).json(response);

  } catch (error: any) {
    console.error("Erro no actionPerguntarController:", error);
    res.status(500).json({ message: "Erro ao conversar com o assistente", error: error.message });
  }
}