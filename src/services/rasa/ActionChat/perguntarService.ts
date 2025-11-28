import { AppError } from '../../../exceptions/AppError';
import 'dotenv/config';
import { makeRequestWithFallback } from '../../../utils/agentUtils';

export async function actionPerguntarService(prompt: string, senderId: string, systemPrompt: string) {

  // O 'prompt' que chega aqui é na verdade o PROMPT ENRIQUECIDO, mas o 'systemPrompt'
  // que será usado no corpo da requisição é a instrução de comportamento.

  const body = {
    model: 'llama3',
    messages: [
      // Adicionamos o System Prompt para instruir o comportamento do modelo
      { role: 'system', content: systemPrompt },
      // O prompt enriquecido, que contém a pergunta original, vai como a mensagem do usuário
      { role: 'user', content: prompt }
    ],
    stream: false,
    max_tokens: 4096,
    //num_predict: 4096
  };

  const MSG_FORA_ESCOPO_PT = "Desculpe, só posso conversar sobre programação, algoritmos e tópicos relacionados. Pode me perguntar sobre variáveis, listas, ou até mesmo Docker!";
  const MSG_FORA_ESCOPO_EN_PADRAO = "I'm not able to respond to that request, but I can answer other questions. How can I help you with something else?";

  try {

    const ollamaApiResponse = await makeRequestWithFallback(body);



    let ollamaReply = ollamaApiResponse.data?.choices?.[0]?.message?.content;

    if (!ollamaReply) {

      throw new AppError('resposta inválida do assistente de ia.', 500);
    }

    const cleanedOllamaReply = ollamaReply.trim();

    // Reforçamos o filtro para capturar tanto a mensagem em inglês quanto a mensagem exata em português (caso o Llama a gere devido ao System Prompt)
    if (cleanedOllamaReply.includes(MSG_FORA_ESCOPO_EN_PADRAO) ||
      cleanedOllamaReply.toLowerCase().includes("i'm not able to respond to that request") ||
      cleanedOllamaReply.includes(MSG_FORA_ESCOPO_PT) // Captura a mensagem que o Llama pode gerar por causa da instrução
    ) {


      ollamaReply = MSG_FORA_ESCOPO_PT; // Garante que a mensagem seja EXATAMENTE a padronizada
    }



    return {
      responses: [{
        recipient_id: senderId,
        text: ollamaReply,
      }],
    };
  } catch (error: any) {

    throw new AppError('falha ao se comunicar com o assistente de ia.', 500);
  }
}