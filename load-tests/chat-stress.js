import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const profile = (__ENV.K6_PROFILE || "smoke").toLowerCase();
const testMode = (__ENV.K6_TEST || "all").toLowerCase();
const baseUrl = (__ENV.BASE_URL || "http://localhost:43187").replace(
  /\/+$/,
  "",
);
const apiKey = __ENV.API_KEY || "";

const users = {
  none: {
    email: __ENV.K6_NONE_EMAIL || "",
    password: __ENV.K6_NONE_PASSWORD || "",
  },
  context: {
    email: __ENV.K6_CONTEXT_EMAIL || "",
    password: __ENV.K6_CONTEXT_PASSWORD || "",
  },
  self: {
    email: __ENV.K6_SELF_EMAIL || "",
    password: __ENV.K6_SELF_PASSWORD || "",
  },
};

const DEFAULT_MESSAGES = [
  "Explique a diferenca entre if, else e else if com um exemplo simples em JavaScript.",
  "Me ajude a entender laco de repeticao while com um exemplo curto.",
  "Qual a diferenca entre algoritmo e programa?",
  "Explique o que e uma variavel e quando devo usa-la.",
  "O que e uma funcao em programacao? Mostre um exemplo simples.",
  "Com base no material da turma, explique o conceito principal da ultima aula.",
  "Me de um exercicio simples sobre condicionais e depois explique a resposta.",
  "Qual a diferenca entre array e objeto em JavaScript?",
  "Explique o que e um laco for e quando ele e melhor que while.",
  "O que significa inicializar uma variavel?",
  "Como funciona uma expressao booleana?",
  "Explique operadores logicos AND, OR e NOT com exemplos.",
  "O que e pseudocodigo e por que ele ajuda antes de programar?",
  "Crie um algoritmo simples para verificar se um numero e par.",
  "Explique passo a passo como calcular a media de tres notas.",
  "Qual a diferenca entre erro de sintaxe e erro de logica?",
  "O que e entrada, processamento e saida em um algoritmo?",
  "Como eu posso transformar um problema em etapas de algoritmo?",
  "Explique o conceito de depuracao de codigo.",
  "O que e uma condicao composta?",
  "Me mostre um exemplo de if aninhado.",
  "Quando devo usar switch em vez de varios if?",
  "Explique o que e uma lista em programacao.",
  "Como percorrer todos os itens de um array?",
  "Qual a diferenca entre parametro e argumento em uma funcao?",
  "Explique retorno de funcao com um exemplo.",
  "O que e escopo de variavel?",
  "Qual a diferenca entre variavel local e global?",
  "Explique o que e uma constante.",
  "Quando usar let, const e var em JavaScript?",
  "O que e concatenacao de strings?",
  "Como converter texto para numero em JavaScript?",
  "Explique o que e NaN em JavaScript.",
  "O que e uma estrutura de repeticao?",
  "Como evitar loop infinito?",
  "Crie um exemplo de contador usando while.",
  "Crie um exemplo de acumulador usando for.",
  "Qual a diferenca entre contador e acumulador?",
  "Explique o que e modularizacao.",
  "Por que dividir um programa em funcoes?",
  "O que e um fluxo de execucao?",
  "Explique o que acontece linha por linha neste algoritmo simples: ler idade, se idade maior ou igual a 18 mostrar maior de idade.",
  "Como posso validar se um usuario digitou um valor vazio?",
  "Explique como resolver problemas usando decomposicao.",
  "O que e raciocinio logico em programacao?",
  "Me de uma dica para estudar algoritmos melhor.",
  "Como identificar a condicao de parada de um laco?",
  "Explique a diferenca entre incremento e decremento.",
  "O que e operador modulo e para que serve?",
  "Como usar o operador modulo para descobrir numeros pares?",
  "Crie um exercicio sobre arrays para iniciante.",
  "Crie um exercicio sobre funcoes para iniciante.",
  "Crie um exercicio sobre condicionais para iniciante.",
  "Crie um exercicio sobre repeticao para iniciante.",
  "Explique a resposta de um exercicio simples sobre media aritmetica.",
  "Como posso representar um algoritmo em fluxograma?",
  "Qual a diferenca entre dado e informacao?",
  "O que e tipo de dado string?",
  "O que e tipo de dado number?",
  "O que e tipo de dado boolean?",
  "Explique coercao de tipos em JavaScript de forma simples.",
  "Por que comparar com === pode ser melhor que ==?",
  "O que e um objeto literal em JavaScript?",
  "Como acessar uma propriedade de um objeto?",
  "Como adicionar um item em um array?",
  "Como remover o ultimo item de um array?",
  "Explique push e pop em arrays.",
  "Explique shift e unshift em arrays.",
  "O que e uma matriz?",
  "Como pensar em linhas e colunas em uma matriz?",
  "Com base nos materiais da turma, qual tema eu deveria revisar primeiro?",
  "Com base no conteudo da disciplina, me explique um exemplo de algoritmo usado em aula.",
  "Use os materiais da turma para resumir o assunto de condicionais.",
  "Use os materiais da turma para resumir o assunto de repeticao.",
  "Use os materiais da turma para criar uma pergunta de revisao.",
  "Use os materiais da turma para explicar um conceito que apareceu na ultima aula.",
  "Nao entendi o exemplo da aula sobre loops. Pode explicar de outro jeito?",
  "Pode criar um passo a passo para resolver um problema de logica?",
  "Como eu sei qual estrutura de controle usar?",
  "Qual e uma boa estrategia para resolver exercicios de programacao?",
  "Explique por que meu algoritmo precisa ter uma ordem correta.",
  "O que e teste de mesa?",
  "Faça um teste de mesa simples para um algoritmo que soma numeros de 1 a 5.",
  "Explique variaveis de controle em lacos.",
  "Como usar uma flag booleana em um algoritmo?",
  "O que significa quebrar um problema em subproblemas?",
  "Me explique como ler um enunciado de exercicio de programacao.",
  "Como transformar requisitos em codigo?",
  "Qual a diferenca entre requisito e implementacao?",
  "Explique o que e um caso de teste.",
  "Me de exemplos de casos de teste para verificar se um numero e par.",
  "Como lidar com entrada invalida em um algoritmo?",
  "Explique try e catch de forma simples.",
  "O que e uma excecao?",
  "Qual a diferenca entre frontend e backend?",
  "O que e uma API?",
  "Como um frontend conversa com um backend?",
  "O que e uma requisicao HTTP?",
  "Qual a diferenca entre GET e POST?",
  "O que e JSON?",
  "Como representar uma lista de alunos em JSON?",
  "O que e banco de dados?",
  "Por que salvar dados em um banco em vez de variaveis?",
  "O que e uma tabela em banco de dados?",
  "O que e uma chave primaria?",
  "Explique de forma simples o que e SQL.",
  "Qual a diferenca entre SELECT e INSERT?",
];

const messagesFromEnv = (__ENV.K6_MESSAGES || "")
  .split("|||")
  .map((item) => item.trim())
  .filter(Boolean);
const messagePool = messagesFromEnv.length ? messagesFromEnv : DEFAULT_MESSAGES;
const sleepSeconds = Number(__ENV.K6_SLEEP_SECONDS || "1");
const minSleepSeconds = Number(__ENV.K6_MIN_SLEEP_SECONDS || sleepSeconds);
const maxSleepSeconds = Number(__ENV.K6_MAX_SLEEP_SECONDS || sleepSeconds);
const includeMessageDebug =
  String(__ENV.K6_INCLUDE_MESSAGE_DEBUG || "false").toLowerCase() === "true";
const chatPollIntervalSeconds = Number(__ENV.K6_CHAT_POLL_SECONDS || "2");
const chatMaxWaitSeconds = Number(__ENV.K6_CHAT_MAX_WAIT_SECONDS || "600");

export const healthResponseTime = new Trend("health_response_time", true);
export const authResponseTime = new Trend("auth_response_time", true);
export const chatResponseTime = new Trend("chat_response_time", true);
export const chatSubmitResponseTime = new Trend("chat_submit_response_time", true);
export const chatPollResponseTime = new Trend("chat_poll_response_time", true);
export const healthFailures = new Rate("health_failures");
export const authFailures = new Rate("auth_failures");
export const chatFailures = new Rate("chat_failures");
export const chatSemanticFailures = new Rate("chat_semantic_failures");

function targetForProfile() {
  if (profile === "stress") return 100;
  if (profile === "class40") return 40;
  return 1;
}

function durationStages(target) {
  if (profile === "stress") {
    return [
      { duration: "1m", target: Math.max(1, Math.floor(target * 0.2)) },
      { duration: "2m", target: Math.max(1, Math.floor(target * 0.2)) },
      { duration: "1m", target: Math.max(1, Math.floor(target * 0.5)) },
      { duration: "2m", target: Math.max(1, Math.floor(target * 0.5)) },
      { duration: "1m", target },
      { duration: "3m", target },
      { duration: "1m", target: 0 },
    ];
  }

  if (profile === "class40") {
    return [
      { duration: "1m", target },
      { duration: "5m", target },
      { duration: "1m", target: 0 },
    ];
  }

  return [
    { duration: "10s", target },
    { duration: "10s", target: 0 },
  ];
}

function scenarioWanted(name) {
  if (testMode === "all") return true;
  if (testMode === "chat") return ["none", "context", "self"].includes(name);
  return testMode === name;
}

function buildScenarios() {
  const scenarios = {};
  const baseTarget = Number(__ENV.K6_TARGET_VUS || targetForProfile());
  const selectedChatModes = ["none", "context", "self"].filter(scenarioWanted);
  const perChatTarget = Math.max(
    1,
    Math.floor(baseTarget / Math.max(1, selectedChatModes.length)),
  );

  if (scenarioWanted("health")) {
    scenarios.health = {
      executor: profile === "smoke" ? "shared-iterations" : "ramping-vus",
      exec: "healthScenario",
      tags: { scenario_group: "backend_pure", route: "/health/simple" },
      ...(profile === "smoke"
        ? { vus: 1, iterations: 1 }
        : { stages: durationStages(Number(__ENV.K6_HEALTH_VUS || baseTarget)) }),
    };
  }

  if (scenarioWanted("auth")) {
    scenarios.auth = {
      executor: profile === "smoke" ? "shared-iterations" : "ramping-vus",
      exec: "authScenario",
      tags: { scenario_group: "auth_pure", route: "/auth/session" },
      ...(profile === "smoke"
        ? { vus: 1, iterations: 1 }
        : { stages: durationStages(Number(__ENV.K6_AUTH_VUS || baseTarget)) }),
    };
  }

  for (const mode of selectedChatModes) {
    scenarios[`chat_${mode}`] = {
      executor: profile === "smoke" ? "shared-iterations" : "ramping-vus",
      exec: "chatScenario",
      env: { K6_CHAT_MODE: mode },
      tags: { scenario_group: `chat_${mode}`, route: "/chat/messages/stream" },
      ...(profile === "smoke"
        ? { vus: 1, iterations: 1 }
        : { stages: durationStages(Number(__ENV.K6_CHAT_VUS || perChatTarget)) }),
    };
  }

  return scenarios;
}

export const options = {
  scenarios: buildScenarios(),
  thresholds: {
    checks: ["rate>0.95"],
    health_failures: ["rate<0.01"],
    auth_failures: ["rate<0.05"],
    chat_failures: ["rate<0.05"],
    chat_semantic_failures: ["rate<0.05"],
    http_req_failed: ["rate<0.05"],
    health_response_time: ["p(95)<1000"],
    auth_response_time: ["p(95)<3000"],
    chat_submit_response_time: ["p(95)<3000"],
    chat_poll_response_time: ["p(95)<3000"],
    chat_response_time: ["p(95)<300000"],
  },
};

function headers(extra = {}) {
  const output = { ...extra };
  if (apiKey) output["x-api-key"] = apiKey;
  return output;
}

function parseResponseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

function parseSseEvents(body) {
  const events = [];
  let event = "message";
  let data = [];

  function flush() {
    if (!data.length) {
      event = "message";
      return;
    }

    events.push({ event, data: data.join("\n") });
    event = "message";
    data = [];
  }

  String(body || "")
    .split(/\r?\n/)
    .forEach((line) => {
      if (!line) {
        flush();
        return;
      }

      if (line.startsWith(":")) return;

      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
        return;
      }

      if (line.startsWith("data:")) {
        data.push(line.slice(5).trimStart());
      }
    });

  flush();
  return events;
}

function parseEventJson(event) {
  try {
    return JSON.parse(event?.data || "{}");
  } catch {
    return {};
  }
}

function isFallbackProvider(provider) {
  return String(provider || "").toLowerCase().includes("fallback");
}

function isTechnicalFallbackText(text) {
  return String(text || "")
    .toLowerCase()
    .includes("tive um problema tecnico");
}

function pickMessage() {
  return messagePool[Math.floor(Math.random() * messagePool.length)];
}

function pickSleepSeconds() {
  const min = Number.isFinite(minSleepSeconds) ? Math.max(0, minSleepSeconds) : 1;
  const max = Number.isFinite(maxSleepSeconds)
    ? Math.max(0, maxSleepSeconds)
    : min;
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

function pollChatJob(jobId, token, mode) {
  const startedAt = Date.now();
  let lastBody = null;
  let polls = 0;

  while ((Date.now() - startedAt) / 1000 < chatMaxWaitSeconds) {
    sleep(chatPollIntervalSeconds);
    polls += 1;

    const response = http.get(`${baseUrl}/chat/jobs/${jobId}`, {
      headers: headers({ Cookie: `token=${token}` }),
      tags: { route: "/chat/jobs/:jobId", scenario_group: `chat_${mode}`, rag_mode: mode },
    });
    chatPollResponseTime.add(response.timings.duration, { rag_mode: mode });

    lastBody = parseResponseJson(response);
    if (response.status !== 200) {
      return { ok: false, response, body: lastBody, polls, reason: "poll_http_error" };
    }

    if (lastBody?.status === "done" || lastBody?.status === "failed") {
      return {
        ok: lastBody.status === "done",
        response,
        body: lastBody,
        polls,
        reason: lastBody.status,
      };
    }
  }

  return { ok: false, response: null, body: lastBody, polls, reason: "poll_timeout" };
}

function login(mode) {
  const user = users[mode];
  if (!user?.email || !user?.password) {
    fail(`Credenciais ausentes para modo ${mode}. Configure K6_${mode.toUpperCase()}_EMAIL e K6_${mode.toUpperCase()}_PASSWORD.`);
  }

  const loginResponse = http.post(
    `${baseUrl}/auth/session`,
    JSON.stringify({ email: user.email, password: user.password }),
    {
      headers: headers({ "Content-Type": "application/json" }),
      tags: { route: "/auth/session", scenario_group: `login_${mode}` },
    },
  );

  const loginOk = check(loginResponse, {
    [`${mode} login status is 200`]: (response) => response.status === 200,
    [`${mode} login returned token cookie`]: (response) =>
      Boolean(response.cookies?.token?.[0]?.value),
  });

  if (!loginOk) {
    fail(
      `${mode} login failed with status ${loginResponse.status}: ${loginResponse.body}`,
    );
  }

  return loginResponse.cookies.token[0].value;
}

export function setup() {
  const chatModes = ["none", "context", "self"].filter(scenarioWanted);
  const tokens = {};

  for (const mode of chatModes) {
    tokens[mode] = login(mode);
  }

  return {
    tokens,
    runId: String(Date.now()),
  };
}

export function healthScenario() {
  const response = http.get(`${baseUrl}/health/simple`, {
    tags: { route: "/health/simple", scenario_group: "backend_pure" },
  });

  healthResponseTime.add(response.timings.duration);
  healthFailures.add(response.status !== 200);

  check(response, {
    "health status is 200": (res) => res.status === 200,
    "health body is OK": (res) => String(res.body || "").trim() === "OK",
  });

  sleep(pickSleepSeconds());
}

export function authScenario() {
  const mode = ["none", "context", "self"][(__VU - 1) % 3];
  const user = users[mode];
  if (!user?.email || !user?.password) {
    fail(`Credenciais ausentes para auth ${mode}.`);
  }

  const response = http.post(
    `${baseUrl}/auth/session`,
    JSON.stringify({ email: user.email, password: user.password }),
    {
      headers: headers({ "Content-Type": "application/json" }),
      tags: { route: "/auth/session", scenario_group: "auth_pure", rag_mode: mode },
    },
  );

  authResponseTime.add(response.timings.duration);
  authFailures.add(response.status !== 200);

  check(response, {
    "auth status is 200": (res) => res.status === 200,
    "auth returned token cookie": (res) =>
      Boolean(res.cookies?.token?.[0]?.value),
  });

  sleep(pickSleepSeconds());
}

export function chatScenario(data) {
  const mode = __ENV.K6_CHAT_MODE || "none";
  const token = data.tokens?.[mode];
  if (!token) fail(`Token ausente para chat mode ${mode}.`);

  const sessionId = `k6-${mode}-${data.runId}-vu-${__VU}`;
  const message = pickMessage();
  const payload = {
    sessionId,
    message: includeMessageDebug
      ? `${message} [mode=${mode} vu=${__VU} iter=${__ITER}]`
      : message,
  };

  const startedAt = Date.now();
  const response = http.post(
    `${baseUrl}/chat/messages/stream`,
    JSON.stringify(payload),
    {
      headers: headers({
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      }),
      timeout: "10m",
      tags: { route: "/chat/messages/stream", scenario_group: `chat_${mode}`, rag_mode: mode },
    },
  );

  chatSubmitResponseTime.add(response.timings.duration, { rag_mode: mode });
  const events = parseSseEvents(response.body);
  const sessionEvent = events.find((item) => item.event === "session");
  const doneEvent = events.find((item) => item.event === "done");
  const errorEvent = events.find((item) => item.event === "error");
  const sessionBody = parseEventJson(sessionEvent);
  const doneBody = parseEventJson(doneEvent);
  const assistantText = events
    .filter((item) => item.event === "token")
    .map((item) => parseEventJson(item).text || "")
    .join("");
  const provider = doneBody?.provider || "";
  const streamOk =
    response.status === 200 &&
    Boolean(sessionEvent) &&
    sessionBody?.sessionId === sessionId &&
    Boolean(doneEvent) &&
    !errorEvent &&
    Boolean(assistantText);
  const semanticFailure =
    streamOk &&
    (isFallbackProvider(provider) || isTechnicalFallbackText(assistantText));
  const totalMs = Date.now() - startedAt;

  chatResponseTime.add(totalMs, { rag_mode: mode });
  chatFailures.add(!streamOk || semanticFailure, { rag_mode: mode });
  chatSemanticFailures.add(semanticFailure, { rag_mode: mode });

  check(response, {
    [`${mode} chat stream status is 200`]: (res) => res.status === 200,
    [`${mode} chat stream returned session event`]: () => Boolean(sessionEvent),
    [`${mode} chat stream returned done event`]: () => Boolean(doneEvent),
    [`${mode} chat stream returned no error event`]: () => !errorEvent,
    [`${mode} chat stream returned assistant text`]: () => Boolean(assistantText),
    [`${mode} chat stream returned session id`]: () => sessionBody?.sessionId === sessionId,
    [`${mode} chat provider is not fallback`]: () => !isFallbackProvider(provider),
    [`${mode} chat did not return technical fallback`]: () =>
      !isTechnicalFallbackText(assistantText),
  });

  sleep(pickSleepSeconds());
}
