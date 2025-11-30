import { AppError } from "../../exceptions/AppError";
import { makeRequestWithFallback } from "../../utils/agentUtils"

export async function rasaSendService(message: string, sender: string): Promise<any> {
  if (!sender) {
    throw new AppError("sender (usuário) não pode ser indefinido.", 400);
  }

  const prompt = `Você é um tutor de lógica de programação. Responda a pergunta do usuário de forma clara, concisa e didática. A pergunta do usuário é: '${message}'`;

  const body = {
    model: 'llama3',
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  };

  try {
    const response = await makeRequestWithFallback(body);
    const ollamaReply = response.data?.choices?.[0]?.message?.content;

    if (!ollamaReply) {

      return [{ recipient_id: sender, text: "Desculpe, não consegui obter uma resposta do assistente." }];
    }

    return [{ recipient_id: sender, text: ollamaReply }];

  } catch (error: any) {

    throw new AppError("falha ao se comunicar com o assistente de ia.", 500);
  }
}