import axios, { AxiosResponse } from "axios";
import dotenv from "dotenv";
import { AppError } from "../../exceptions/AppError"; // Ajuste o caminho se necessário

dotenv.config();

// As variáveis de ambiente agora devem ser as do Ollama
const OLLAMA_API_URL = process.env.OLLAMA_API_URL as string;
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY as string;

if (!OLLAMA_API_URL || !OLLAMA_API_KEY) {
  console.error("ERRO CRÍTICO: Variáveis de ambiente OLLAMA_API_URL ou OLLAMA_API_KEY não definidas no arquivo .env");
}

// A função mantém o mesmo nome e parâmetros para não quebrar o controller
async function rasaSendService(message: string, sender: string): Promise<any> {
  if (!sender) {
    throw new Error("Sender (usuário) não pode ser indefinido.");
  }

  // Monta o prompt para o Ollama
  const prompt = `Você é um tutor de lógica de programação. Responda a pergunta do usuário de forma clara, concisa e didática. A pergunta do usuário é: '${message}'`;

  // Monta o corpo e os cabeçalhos para a requisição do Ollama
  const body = {
    model: 'llama3',
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  };

  const headers = {
    'Authorization': `Bearer ${OLLAMA_API_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    console.log(`[Service modificado] Enviando para OLLAMA: "${message}"`);

    // Faz a chamada para a API do Ollama
    const response: AxiosResponse<any, any> = await axios.post(OLLAMA_API_URL, body, { headers });

    // Extrai a resposta do Ollama
    const ollamaReply = response.data?.choices?.[0]?.message?.content;

    if (!ollamaReply) {
      console.warn("[Service modificado] Resposta do Ollama veio vazia ou em formato inesperado.");
      return [{ recipient_id: sender, text: "Desculpe, não consegui obter uma resposta do assistente." }];
    }

    // Retorna a resposta do Ollama no formato que o RasaSendController espera (um array com objetos de texto)
    return [{ recipient_id: sender, text: ollamaReply }];

  } catch (error: any) {
    console.error("[Service modificado] Erro ao conectar ao OLLAMA. Status:", error.response?.status, "Dados:", error.response?.data);
    throw new AppError("Falha ao se comunicar com o assistente de IA.", 500);
  }
}

export { rasaSendService };