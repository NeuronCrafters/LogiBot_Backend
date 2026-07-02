// Política de retry compartilhada para chamadas aos agentes de IA (DigitalOcean).
//
// Os agentes entram em repouso/cold start quando ficam ociosos: a primeira
// requisição depois de ocioso costuma falhar por timeout, conexão recusada ou
// 401/5xx enquanto o agente "acorda". Este helper centraliza a lógica de
// retentar algumas vezes antes de desistir, usada tanto pelo pool de agentes
// (chatbot + quiz) quanto pelo agente dedicado de insights.

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDefaultMaxAttempts() {
  const value = Number(process.env.AGENT_MAX_ATTEMPTS || 3);
  return Number.isInteger(value) && value > 0 ? value : 3;
}

function getDefaultRetryDelayMs() {
  const value = Number(process.env.AGENT_RETRY_DELAY_MS || 1500);
  return Number.isFinite(value) && value > 0 ? value : 1500;
}

const RETRYABLE_ERROR_CODES = new Set([
  "ECONNABORTED", // axios timeout
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
]);

function isAbortError(error: any): boolean {
  return (
    error?.name === "CanceledError" ||
    error?.code === "ERR_CANCELED" ||
    error?.name === "AbortError"
  );
}

// Retenta em falhas transitórias típicas de cold start: sem resposta HTTP
// (rede/DNS/conexão), timeout, ou status 401/429/5xx. Não retenta em abort do
// usuário nem em erros de validação 4xx (400/403/404/422 etc.).
export function isRetryableAgentError(error: any): boolean {
  if (isAbortError(error)) return false;

  const status = error?.response?.status;

  // Sem response = erro de rede / conexão / DNS / timeout (cold start "dormindo").
  if (status === undefined || status === null) {
    if (typeof error?.code === "string" && RETRYABLE_ERROR_CODES.has(error.code)) {
      return true;
    }
    // axios preenche `error.request` quando a requisição foi feita mas nenhuma
    // resposta chegou (socket hang up, timeout sem code padronizado, etc.).
    // Erros genéricos lançados pelo nosso próprio código (validação, JSON
    // inválido) não têm `request` e portanto NÃO são retentados.
    return Boolean(error?.request);
  }

  return status === 401 || status === 429 || (status >= 500 && status < 600);
}

export type WithAgentRetryOptions = {
  maxAttempts?: number;
  delayMs?: number;
  isRetryable?: (error: any) => boolean;
  onRetry?: (info: { attempt: number; error: any; delayMs: number }) => void;
};

// Executa `fn(attempt)` em loop até `maxAttempts`. Entre tentativas aplica
// backoff linear (`delayMs * attempt`) apenas quando o erro for retentável;
// caso contrário relança de imediato. Após esgotar as tentativas, relança o
// último erro (o chamador decide se converte em fallback/null ou propaga).
export async function withAgentRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: WithAgentRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? getDefaultMaxAttempts();
  const delayMs = options.delayMs ?? getDefaultRetryDelayMs();
  const isRetryable = options.isRetryable ?? isRetryableAgentError;

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts || !isRetryable(error)) break;

      const waitMs = delayMs * attempt;
      options.onRetry?.({ attempt, error, delayMs: waitMs });
      await sleep(waitMs);
    }
  }

  throw lastError;
}
