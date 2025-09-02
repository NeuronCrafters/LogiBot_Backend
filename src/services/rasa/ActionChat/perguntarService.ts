import axios from 'axios';
import { AppError } from '../../../exceptions/AppError';
import 'dotenv/config';

interface AgentConfig {
  url: string;
  key: string;
}

function getApiConfigs(): AgentConfig[] {
  const configs: AgentConfig[] = [];

  for (let i = 1; i <= 12; i++) {
    const url = process.env[`OLLAMA_API_URL_${i}`];
    const key = process.env[`Key_A${i}`];

    if (url && key) {
      configs.push({ url, key });
    }
  }

  return configs;
}

let cachedConfigs: AgentConfig[] = [];
let configsLastUpdated = 0;
const CONFIG_CACHE_TIME = 5 * 60 * 1000;

function getValidConfigs(): AgentConfig[] {
  const now = Date.now();

  if (now - configsLastUpdated > CONFIG_CACHE_TIME || cachedConfigs.length === 0) {
    cachedConfigs = getApiConfigs();
    configsLastUpdated = now;

    if (cachedConfigs.length === 0) {
      console.error("ERRO CRÍTICO: Nenhuma configuração de agente (OLLAMA_API_URL_n / Key_An) encontrada.");
    } else {
      console.log(`[API Config] ${cachedConfigs.length} configurações de agente válidas carregadas.`);
    }
  }

  return cachedConfigs;
}

let agentRotationIndex = 0;

function getNextApiConfig(): AgentConfig {
  const configs = getValidConfigs();
  if (configs.length === 0) {
    throw new AppError("Nenhuma configuração de API de agente válida disponível", 500);
  }

  const config = configs[agentRotationIndex % configs.length];
  agentRotationIndex = (agentRotationIndex + 1) % configs.length;
  return config;
}

async function makeRequestWithFallback(body: any, maxRetries: number = 3): Promise<any> {
  const configs = getValidConfigs();
  if (configs.length === 0) {
    throw new AppError("Nenhuma configuração de API disponível", 500);
  }

  const triedConfigs: string[] = [];

  for (let attempt = 0; attempt < Math.min(maxRetries, configs.length); attempt++) {
    const config = getNextApiConfig();
    const configId = `${config.url.substring(0, 20)}...${config.key.substring(0, 10)}...`;

    if (triedConfigs.includes(configId)) continue;
    triedConfigs.push(configId);

    const headers = {
      'Authorization': `Bearer ${config.key}`,
      'Content-Type': 'application/json',
    };

    try {
      console.log(`[API Request] Tentativa ${attempt + 1} com o agente: ${configId}`);

      const response = await axios.post(config.url, body, {
        headers,
        timeout: 30000
      });

      console.log(`[API Request] Sucesso com o agente: ${configId}`);
      return response;

    } catch (error: any) {
      const status = error.response?.status;
      const errorMsg = error.response?.data?.error || error.message;
      console.warn(`[API Request] Falha com o agente ${configId}: Status ${status} - ${errorMsg}`);

      if (status === 429 || status === 408 || error.code === 'ECONNABORTED' || (status >= 400 && status < 500)) {
        console.log(`[API Request] Tentando próximo agente...`);
        continue;
      }
      if (status >= 500) {
        console.log(`[API Request] Erro do servidor, aguardando 1s antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
    }
  }

  console.error(`[API Request] Todas as ${triedConfigs.length} tentativas com agentes falharam.`);
  throw new AppError(
    `Falha ao se comunicar com o assistente de IA após ${triedConfigs.length} tentativas`,
    500
  );
}

export async function actionPerguntarService(userText: string, senderId: string) {
  const prompt = `Você é um tutor de lógica de programação. Responda a pergunta do usuário de forma clara, concisa e didática. A pergunta do usuário é: '${userText}'`;
  const body = {
    model: 'llama3',
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  };

  try {
    console.log(`[actionPerguntarService] Enviando pergunta direta: "${userText}"`);
    const ollamaApiResponse = await makeRequestWithFallback(body);
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
    console.error('[actionPerguntarService] Erro final:', error.message);
    throw new AppError('Falha ao se comunicar com o assistente de IA.', 500);
  }
}