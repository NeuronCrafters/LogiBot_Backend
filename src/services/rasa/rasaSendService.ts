import { AppError } from "../../exceptions/AppError";
import { makeRequestWithFallback } from "../../utils/agentUtils"

/**
 * Service para enviar mensagens do Rasa para o assistente de IA.
 */
export async function rasaSendService(message: string, sender: string): Promise<any> {
  if (!sender) {
    // Usar AppError para consistência de erros
    throw new AppError("Sender (usuário) não pode ser indefinido.", 400);
  }

  // 1. Monta o prompt
  const prompt = `Você é um tutor de lógica de programação. Responda a pergunta do usuário de forma clara, concisa e didática. A pergunta do usuário é: '${message}'`;

  const body = {
    model: 'llama3',
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  };

  try {
    console.log(`[rasaSendService] Enviando mensagem para o ciclo de agentes: "${message}"`);

    // 2. Chama a função centralizada
    const response = await makeRequestWithFallback(body);
    const ollamaReply = response.data?.choices?.[0]?.message?.content;

    // 3. Valida a resposta
    if (!ollamaReply) {
      console.warn("[rasaSendService] Resposta do Ollama veio vazia ou em formato inesperado.");
      return [{ recipient_id: sender, text: "Desculpe, não consegui obter uma resposta do assistente." }];
    }

    // 4. Formata e retorna a resposta
    return [{ recipient_id: sender, text: ollamaReply }];

  } catch (error: any) {
    console.error("[rasaSendService] Erro final no ciclo de agentes:", error.message);
    throw new AppError("Falha ao se comunicar com o assistente de IA.", 500);
  }
}