import axios from 'axios';
import { AppError } from "../exceptions/AppError"
import dotenv from "dotenv";

dotenv.config();

interface AgentConfig {
  url: string;
  key: string;
}

export function getApiConfigs(): AgentConfig[] {
  const configs: AgentConfig[] = [];
  for (let i = 1; i <= 20; i++) {
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
      console.error("erro crítico: nenhuma configuração de agente encontrada.");
    } else {
      console.log(`[api config] ${cachedConfigs.length} configurações válidas carregadas.`);
    }
  }
  return cachedConfigs;
}

let agentRotationIndex = 0;

function getNextApiConfig(): AgentConfig {
  const configs = getValidConfigs();
  if (configs.length === 0) {
    throw new AppError("Nenhuma configuração de API válida disponível", 500);
  }
  const config = configs[agentRotationIndex % configs.length];
  agentRotationIndex = (agentRotationIndex + 1) % configs.length;
  return config;
}

export async function makeRequestWithFallback(body: any, maxRetries: number = 3): Promise<any> {
  const configs = getValidConfigs();
  if (configs.length === 0) {
    throw new AppError("Nenhuma configuração de API disponível", 500);
  }

  const triedConfigs: string[] = [];
  const originalMessage = body.messages[0]?.content || 'Mensagem não encontrada';
  console.log(`[debug-cycle] iniciando ciclo de agentes para a mensagem: "${originalMessage.substring(0, 100)}..."`);

  for (let attempt = 0; attempt < Math.min(maxRetries, configs.length); attempt++) {
    const config = getNextApiConfig();
    const configId = config.url;

    if (triedConfigs.includes(configId)) continue;
    triedConfigs.push(configId);

    try {
      console.log(`[debug-cycle] tentativa ${attempt + 1}/${Math.min(maxRetries, configs.length)} com o agente: ${configId}`);
      const response = await axios.post(config.url, body, {
        headers: { 'Authorization': `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        timeout: 30000
      });
      const responseText = response.data?.choices?.[0]?.message?.content || JSON.stringify(response.data);
      console.log(`[debug-cycle]  sucesso com ${configId}. resposta: "${responseText.substring(0, 80)}..."`);
      return response;
    } catch (error: any) {
      const status = error.response?.status;
      const errorMsg = error.response?.data?.error || error.message;
      console.warn(`[debug-cycle]  falha com ${configId}: status ${status} - ${errorMsg}`);
    }
  }

  console.error(`[debug-cycle]  todas as ${triedConfigs.length} tentativas com agentes falharam.`);
  throw new AppError(`Falha ao se comunicar com o IA após ${triedConfigs.length} tentativas`, 500);
}