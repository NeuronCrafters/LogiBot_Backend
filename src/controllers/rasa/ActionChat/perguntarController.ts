import { Request, Response } from "express";
import { actionPerguntarService } from "../../../services/rasa/ActionChat/perguntarService";
import { UserAnalysis } from "@/models/UserAnalysis";
import { normalizeSubjectFromMessage } from "../../../utils/normalizeSubject"; // Verifique se este caminho está correto

export async function actionPerguntarController(req: Request, res: Response) {
  const { message } = req.body;
  const senderId = req.user?.id || "user";

  if (!message) {
    return res.status(400).json({ error: "Texto da mensagem é obrigatório." });
  }

  try {
    // 1. Chama o serviço que fala com o Ollama
    const response = await actionPerguntarService(message, senderId);

    // 2. Procura pela análise do usuário
    const userAnalysis = await UserAnalysis.findOne({ userId: senderId });

    if (userAnalysis) {
      const lastSession = userAnalysis.sessions.at(-1);

      // 3. Verifica se existe uma sessão ativa
      if (lastSession && !lastSession.sessionEnd) {

        // 4. Normaliza o assunto da mensagem do usuário
        const subject = normalizeSubjectFromMessage(message);

        // 5. ATUALIZA O CONTADOR DE ASSUNTO DO CHAT (isto já existe no seu schema)
        // Esta é a única operação possível no seu schema atual sem modificá-lo.
        userAnalysis.updateSubjectCountsChat(subject);

        // 6. Salva a alteração
        await userAnalysis.save();

        console.log(`[UserAnalysis] Contagem de assunto '${subject}' atualizada para o chat.`);
      }
    }

    // 7. Retorna a resposta do bot para o frontend
    res.status(200).json(response);

  } catch (error: any) {
    console.error("Erro ao conversar com o assistente:", error);
    res.status(500).json({ message: "Erro ao conversar com o assistente", error: error.message });
  }
}