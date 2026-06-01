import { AppError } from '../../../exceptions/AppError';
import 'dotenv/config';
import { makeRequestWithFallback } from '../../../utils/agentUtils';

export async function actionPerguntarService(prompt: string, senderId: string, systemPrompt: string) {
  const body = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    stream: false,
    max_tokens: 4096,
  };

  const MSG_FORA_ESCOPO_PT = "Desculpe, só posso conversar sobre programação, algoritmos e tópicos relacionados. Pode me perguntar sobre variáveis, listas, ou até mesmo Docker!";
  const MSG_FORA_ESCOPO_EN_PADRAO = "I'm not able to respond to that request, but I can answer other questions. How can I help you with something else?";

  try {
    const aiResponse = await makeRequestWithFallback(body);
    let aiReply = aiResponse.data?.choices?.[0]?.message?.content;

    if (!aiReply) {
      throw new AppError('resposta inválida do assistente de ia.', 500);
    }

    const cleanedAiReply = aiReply.trim();

    if (cleanedAiReply.includes(MSG_FORA_ESCOPO_EN_PADRAO) ||
      cleanedAiReply.toLowerCase().includes("i'm not able to respond to that request") ||
      cleanedAiReply.includes(MSG_FORA_ESCOPO_PT)
    ) {
      aiReply = MSG_FORA_ESCOPO_PT;
    }

    return {
      responses: [{
        recipient_id: senderId,
        text: aiReply,
      }],
    };
  } catch (error: any) {
    throw new AppError('falha ao se comunicar com o assistente de ia.', 500);
  }
}
