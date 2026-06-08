import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const profile = (__ENV.K6_PROFILE || "smoke").toLowerCase();
const baseUrl = (__ENV.BASE_URL || "http://localhost:43187").replace(
  /\/+$/,
  "",
);
const apiKey = __ENV.API_KEY || "";
const email = __ENV.K6_EMAIL || "";
const password = __ENV.K6_PASSWORD || "";
const message =
  __ENV.K6_MESSAGE ||
  "Explique rapidamente o que e uma estrutura condicional em programacao.";
const sleepSeconds = Number(__ENV.K6_SLEEP_SECONDS || "1");

export const chatResponseTime = new Trend("chat_response_time", true);
export const chatFailures = new Rate("chat_failures");

const smokeOptions = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ["rate>0.95"],
    chat_failures: ["rate<0.01"],
    chat_response_time: ["p(95)<60000"],
  },
};

const stressOptions = {
  stages: [
    { duration: "1m", target: 20 },
    { duration: "2m", target: 20 },
    { duration: "1m", target: 50 },
    { duration: "2m", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "3m", target: 100 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    checks: ["rate>0.95"],
    chat_failures: ["rate<0.05"],
    http_req_failed: ["rate<0.05"],
    chat_response_time: ["p(95)<60000"],
  },
};

export const options = profile === "stress" ? stressOptions : smokeOptions;

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

export function setup() {
  if (!email || !password) {
    fail("K6_EMAIL and K6_PASSWORD are required.");
  }

  const loginResponse = http.post(
    `${baseUrl}/auth/session`,
    JSON.stringify({ email, password }),
    {
      headers: headers({ "Content-Type": "application/json" }),
      tags: { route: "/auth/session" },
    },
  );

  const loginOk = check(loginResponse, {
    "login status is 200": (response) => response.status === 200,
    "login returned token cookie": (response) =>
      Boolean(response.cookies?.token?.[0]?.value),
  });

  if (!loginOk) {
    fail(
      `Login failed with status ${loginResponse.status}: ${loginResponse.body}`,
    );
  }

  return {
    token: loginResponse.cookies.token[0].value,
    runId: String(Date.now()),
  };
}

export default function (data) {
  const sessionId = `k6-${data.runId}-vu-${__VU}`;
  const payload = {
    sessionId,
    message: `${message} [vu=${__VU} iter=${__ITER}]`,
  };

  const response = http.post(
    `${baseUrl}/chat/messages`,
    JSON.stringify(payload),
    {
      headers: headers({
        "Content-Type": "application/json",
        Cookie: `token=${data.token}`,
      }),
      tags: { route: "/chat/messages" },
    },
  );

  chatResponseTime.add(response.timings.duration);
  chatFailures.add(response.status !== 200);

  check(response, {
    "chat status is 200": (res) => res.status === 200,
    "chat returned assistant text": (res) => {
      const body = parseResponseJson(res);
      return Boolean(body?.responses?.[0]?.text);
    },
    "chat returned session id": (res) => {
      const body = parseResponseJson(res);
      return body?.sessionId === sessionId;
    },
  });

  sleep(Number.isFinite(sleepSeconds) && sleepSeconds >= 0 ? sleepSeconds : 1);
}
