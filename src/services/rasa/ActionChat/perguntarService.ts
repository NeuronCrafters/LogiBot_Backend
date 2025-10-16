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

  try {
    console.log(`[actionPerguntarService] Enviando prompt enriquecido para o ciclo de agentes.`);
    const ollamaApiResponse = await makeRequestWithFallback(body);

    console.log("[Ollama Raw Response]", JSON.stringify(ollamaApiResponse.data, null, 2));

    const ollamaReply = ollamaApiResponse.data?.choices?.[0]?.message?.content;

    if (!ollamaReply) {
      console.error("[actionPerguntarService] Resposta do Ollama em formato inesperado:", ollamaApiResponse.data);
      throw new AppError('Resposta inválida do assistente de IA.', 500);
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