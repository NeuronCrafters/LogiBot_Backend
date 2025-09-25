import { Request, Response } from "express";
import { actionPerguntarService } from "../../../services/rasa/ActionChat/perguntarService";
import { UserAnalysis } from "@/models/UserAnalysis";
import { normalizeSubjectFromMessage } from "../../../utils/normalizeSubject";
import { normalizeText } from "../../../utils/normalizeText";

export async function actionPerguntarController(req: Request, res: Response) {
  // recebe a mensagem original do usuário
  const { message } = req.body;
  const senderId = req.user?.id || "user";

  if (!message) {
    return res.status(400).json({ error: "Texto da mensagem é obrigatório." });
  }

  // normaliza a mensagem para remover acentos e converter para minúsculas
  const normalizedMessage = normalizeText(message);

  try {
    // usa a mensagem normalizada para se comunicar com o serviço da IA
    const response = await actionPerguntarService(normalizedMessage, senderId);

    const userAnalysis = await UserAnalysis.findOne({ userId: senderId });

    if (userAnalysis) {
      const lastSession = userAnalysis.sessions.at(-1);

      if (lastSession && !lastSession.sessionEnd) {
        // usa a mensagem normalizada para extrair o assunto
        const subject = normalizeSubjectFromMessage(normalizedMessage);

        if (subject) {
          userAnalysis.updateSubjectCountsChat(subject);
          await userAnalysis.save();
          console.log(`[UserAnalysis] Contagem de assunto '${subject}' atualizada para o chat.`);
        } else {
          // loga a mensagem normalizada para consistência
          console.log(`[UserAnalysis] Nenhum assunto específico identificado na mensagem: "${normalizedMessage}"`);
        }
      }
    }

    res.status(200).json(response);

  } catch (error: any) {
    console.error("Erro ao conversar com o assistente:", error);
    res.status(500).json({ message: "Erro ao conversar com o assistente", error: error.message });
  }
}