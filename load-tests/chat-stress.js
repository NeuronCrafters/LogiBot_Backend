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

const fallbackMessage =
  __ENV.K6_MESSAGE ||
  "Explique rapidamente o que e uma estrutura condicional em programacao.";
const messages = (__ENV.K6_MESSAGES || "")
  .split("|||")
  .map((item) => item.trim())
  .filter(Boolean);
const messagePool = messages.length ? messages : [fallbackMessage];
const sleepSeconds = Number(__ENV.K6_SLEEP_SECONDS || "1");
const minSleepSeconds = Number(__ENV.K6_MIN_SLEEP_SECONDS || sleepSeconds);
const maxSleepSeconds = Number(__ENV.K6_MAX_SLEEP_SECONDS || sleepSeconds);
const includeMessageDebug =
  String(__ENV.K6_INCLUDE_MESSAGE_DEBUG || "false").toLowerCase() === "true";

export const healthResponseTime = new Trend("health_response_time", true);
export const authResponseTime = new Trend("auth_response_time", true);
export const chatResponseTime = new Trend("chat_response_time", true);
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
      tags: { scenario_group: `chat_${mode}`, route: "/chat/messages" },
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
    chat_response_time: ["p(95)<60000"],
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

  const response = http.post(
    `${baseUrl}/chat/messages`,
    JSON.stringify(payload),
    {
      headers: headers({
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      }),
      tags: { route: "/chat/messages", scenario_group: `chat_${mode}`, rag_mode: mode },
    },
  );

  chatResponseTime.add(response.timings.duration, { rag_mode: mode });
  const body = parseResponseJson(response);
  const assistantText = body?.responses?.[0]?.text || "";
  const provider = body?.provider || "";
  const semanticFailure =
    response.status === 200 &&
    (isFallbackProvider(provider) || isTechnicalFallbackText(assistantText));

  chatFailures.add(response.status !== 200 || semanticFailure, { rag_mode: mode });
  chatSemanticFailures.add(semanticFailure, { rag_mode: mode });

  check(response, {
    [`${mode} chat status is 200`]: (res) => res.status === 200,
    [`${mode} chat returned assistant text`]: () => Boolean(assistantText),
    [`${mode} chat returned session id`]: () => body?.sessionId === sessionId,
    [`${mode} chat provider is not fallback`]: () => !isFallbackProvider(provider),
    [`${mode} chat did not return technical fallback`]: () =>
      !isTechnicalFallbackText(assistantText),
  });

  sleep(pickSleepSeconds());
}
