import { AppError } from '../../../exceptions/AppError';
import 'dotenv/config';
import { makeRequestWithFallback } from '../../../utils/agentUtils';

/**
 * Service para lidar com perguntas diretas do usuário no modo de chat.
 */
export async function actionPerguntarService(userText: string, senderId: string) {
  // 1. Monta o prompt específico para esta ação
  const prompt = `Você é um tutor de lógica de programação. Responda a pergunta do usuário de forma clara, concisa e didática. A pergunta do usuário é: '${userText}'`;

  const body = {
    model: 'llama3',
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  };

  try {
    console.log(`[actionPerguntarService] Enviando pergunta direta para o ciclo de agentes: "${userText}"`);

    // 2. Chama a função centralizada para executar a requisição com fallback e logs
    const ollamaApiResponse = await makeRequestWithFallback(body);
    const ollamaReply = ollamaApiResponse.data?.choices?.[0]?.message?.content;

    // 3. Valida a resposta
    if (!ollamaReply) {
      console.error("[actionPerguntarService] Resposta do Ollama em formato inesperado:", ollamaApiResponse.data);
      throw new AppError('Resposta inválida do assistente de IA.', 500);
    }

    console.log("[actionPerguntarService] Resposta recebida com sucesso.");

    // 4. Formata e retorna a resposta para o controller
    return {
      responses: [{
        recipient_id: senderId,
        text: ollamaReply,
      }],
    };
  } catch (error: any) {
    console.error('[actionPerguntarService] Erro final no ciclo de agentes:', error.message);
    // Re-lança o erro para o controller tratar a resposta HTTP
    throw new AppError('Falha ao se comunicar com o assistente de IA.', 500);
  }
}