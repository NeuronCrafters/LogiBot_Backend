import { AppError } from '../../../exceptions/AppError';
import 'dotenv/config';
import { makeRequestWithFallback } from '../../../utils/agentUtils';

export async function actionPerguntarService(prompt: string, senderId: string) {
  const body = {
    model: 'llama3',
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    max_tokens: 4096,
    //num_predict: 4096
  };

  const MSG_FORA_ESCOPO_PT = "Desculpe, só posso conversar sobre programação, algoritmos e tópicos relacionados. Pode me perguntar sobre variáveis, listas, ou até mesmo Docker!";
  const MSG_FORA_ESCOPO_EN_PADRAO = "I'm not able to respond to that request, but I can answer other questions. How can I help you with something else?";

  try {
    console.log(`[actionPerguntarService] Enviando prompt enriquecido para o ciclo de agentes.`);
    const ollamaApiResponse = await makeRequestWithFallback(body);

    console.log("[Ollama Raw Response]", JSON.stringify(ollamaApiResponse.data, null, 2));

    let ollamaReply = ollamaApiResponse.data?.choices?.[0]?.message?.content;

    if (!ollamaReply) {
      console.error("[actionPerguntarService] Resposta do Ollama em formato inesperado:", ollamaApiResponse.data);
      throw new AppError('Resposta inválida do assistente de IA.', 500);
    }

    const cleanedOllamaReply = ollamaReply.trim();

    if (cleanedOllamaReply.includes(MSG_FORA_ESCOPO_EN_PADRAO) ||
      cleanedOllamaReply.toLowerCase().includes("i'm not able to respond to that request")) {

      console.log("[actionPerguntarService] ⚠️ Resposta fora de escopo em EN detectada. Padronizando para PT.");
      ollamaReply = MSG_FORA_ESCOPO_PT;
    }

    console.log("[actionPerguntarService] Resposta recebida com sucesso.");

    return {
      responses: [{
        recipient_id: senderId,
        text: ollamaReply,
      }],
    };
  } catch (error: any) {
    console.error('[actionPerguntarService] Erro final no ciclo de agentes:', error.message);
    throw new AppError('Falha ao se comunicar com o assistente de IA.', 500);
  }
}