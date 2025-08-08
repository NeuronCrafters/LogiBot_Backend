// src/services/rasa/ActionChat/actionPerguntarService.ts

import axios from 'axios';
import { AppError } from '../../../exceptions/AppError';
import 'dotenv/config';

// A função agora chama o Ollama diretamente.
export async function actionPerguntarService(userText: string, senderId: string) {
  // 1. Pegar as credenciais do Ollama do seu arquivo .env
  const OLLAMA_API_URL = process.env.OLLAMA_API_URL as string;
  const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY as string;

  if (!OLLAMA_API_URL || !OLLAMA_API_KEY) {
    console.error("ERRO: Variáveis de ambiente OLLAMA_API_URL ou OLLAMA_API_KEY não definidas.");
    throw new AppError('Configuração do servidor de IA ausente.', 500);
  }

  // 2. Montar o prompt
  const prompt = `Você é um tutor de lógica de programação. Responda a pergunta do usuário de forma clara, concisa e didática. A pergunta do usuário é: '${userText}'`;

  const headers = {
    'Authorization': `Bearer ${OLLAMA_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const body = {
    model: 'llama3',
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  };

  try {
    console.log(`[Service->Ollama] Enviando pergunta direta: "${userText}"`);

    // 3. Fazer a chamada para a API do Ollama
    const ollamaApiResponse = await axios.post(OLLAMA_API_URL, body, { headers });

    // 4. Extrair a resposta do Ollama
    const ollamaReply = ollamaApiResponse.data?.choices?.[0]?.message?.content;

    if (!ollamaReply) {
      console.error("[Service->Ollama] Resposta do Ollama em formato inesperado:", ollamaApiResponse.data);
      throw new AppError('Resposta inválida do assistente de IA.', 500);
    }

    console.log("[Service->Ollama] Resposta recebida com sucesso.");

    // 5. Retornar a resposta em um formato que o controller espera
    // Simulamos a estrutura de resposta do Rasa para minimizar mudanças no controller
    return {
      responses: [{
        recipient_id: senderId,
        text: ollamaReply,
      }],
    };

  } catch (error: any) {
    console.error('[Service->Ollama] Erro na comunicação com Ollama:', error.response?.data || error.message);
    throw new AppError('Falha ao se comunicar com o assistente de IA.', 500);
  }
}