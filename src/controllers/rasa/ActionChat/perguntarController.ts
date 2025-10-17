import { Request, Response } from "express";
import { actionPerguntarService } from "../../../services/rasa/ActionChat/perguntarService";
import { UserAnalysis } from "@/models/UserAnalysis";
// Importa o validador e a nova função de enriquecimento
import { validateAndEnrichPrompt } from "../../../utils/subjectExtractor";

export async function actionPerguntarController(req: Request, res: Response) {
  const { message } = req.body;
  const senderId = req.user?.id || "user";

  if (!message) {
    return res.status(400).json({ error: "Texto da mensagem é obrigatório." });
  }

  // A validação agora retorna o subject, o prompt ENRIQUECIDO E O NOVO SYSTEM PROMPT
  const validationResult = validateAndEnrichPrompt(message);

  if (!validationResult) {
    // Caminho de bloqueio já está correto e garante a mensagem padronizada
    return res.status(200).json({
      responses: [{
        text: "Desculpe, só posso conversar sobre programação, algoritmos e tópicos relacionados. Pode me perguntar sobre variáveis, listas, ou até mesmo Docker!"
      }]
    });
  }

  // Desestrutura o novo systemPrompt
  const { subject, prompt, systemPrompt } = validationResult;

  try {
    // Passa o systemPrompt para o service
    const response = await actionPerguntarService(prompt, senderId, systemPrompt);

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