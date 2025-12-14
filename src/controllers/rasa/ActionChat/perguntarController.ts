import { Request, Response } from "express";
import { actionPerguntarService } from "../../../services/rasa/ActionChat/perguntarService";
import { UserAnalysis } from "@/models/UserAnalysis";
import { validateAndEnrichPrompt } from "../../../utils/subjectExtractor";
import { ChatHistoryService } from "../../../services/bot/chat/chatHistoryService";

export async function actionPerguntarController(req: Request, res: Response) {
  const { message, sessionId } = req.body;
  const senderId = req.user?.id || "user";

  if (!message) {
    return res.status(400).json({ error: "Texto da mensagem é obrigatório." });
  }

  const chatService = new ChatHistoryService();
  let currentSessionId = sessionId;

  const validationResult = validateAndEnrichPrompt(message);

  if (!validationResult) {
    const fallbackResponse = "Desculpe, só posso conversar sobre programação, algoritmos e tópicos relacionados. Pode me perguntar sobre variáveis, listas, ou até mesmo Docker!";

    const userMsgResult = await chatService.addMessage({
      userId: senderId,
      sessionId: currentSessionId,
      role: 'user',
      content: message
    });

    currentSessionId = userMsgResult.sessionId;

    await chatService.addMessage({
      userId: senderId,
      sessionId: currentSessionId,
      role: 'assistant',
      content: fallbackResponse
    });

    return res.status(200).json({
      responses: [{ text: fallbackResponse }],
      sessionId: currentSessionId
    });
  }

  const { subject, prompt, systemPrompt } = validationResult;

  try {
    const userMsgResult = await chatService.addMessage({
      userId: senderId,
      sessionId: currentSessionId,
      role: 'user',
      content: message,
      topic: subject
    });

    currentSessionId = userMsgResult.sessionId;

    const response = await actionPerguntarService(prompt, senderId, systemPrompt);
    const aiText = response.responses[0]?.text || "Erro ao gerar resposta.";

    await chatService.addMessage({
      userId: senderId,
      sessionId: currentSessionId,
      role: 'assistant',
      content: aiText,
      topic: subject
    });

    const userAnalysis = await UserAnalysis.findOne({ userId: senderId });

    if (userAnalysis) {
      const lastSession = userAnalysis.sessions.at(-1);
      if (lastSession && !lastSession.sessionEnd) {
        userAnalysis.updateSubjectCountsChat(subject as any);
        await userAnalysis.save();
      }
    }

    res.status(200).json({
      ...response,
      sessionId: currentSessionId
    });

  } catch (error: any) {
    res.status(500).json({ message: "erro ao conversar com o assistente", error: error.message });
  }
}