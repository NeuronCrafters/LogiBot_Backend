import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { readFileSync } from "fs";
import { askOpenRouter, streamOpenRouter } from "../services/ai/openRouterService";
import { askQuizAiAgent } from "../services/ai/quizAiAgentService";
import { askDashboardInsightsAgent } from "../services/ai/dashboardInsightsAgentService";

type CapturedRequest = {
  path: string;
  authorization: string;
  body: { model: string; stream?: boolean; messages: { role: string; content: string }[] };
};

describe("OpenRouter HTTP", () => {
  const originalEnv = { ...process.env };
  let server: Server;
  let requests: CapturedRequest[];
  let status: number;

  beforeAll(async () => {
    server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString());
      requests.push({ path: req.url, authorization: req.headers.authorization, body });
      if (status !== 200) {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { code: status, message: "Provider failure" } }));
      } else if (body.stream) {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.write(': OPENROUTER PROCESSING\n\ndata: {"choices":[{"delta":{"content":"Olá"}}]}\n\n');
        res.end('data: [DONE]\n\n');
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ model: "test/returned", choices: [{ message: { content: "Resposta HTTP" } }] }));
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.OPENROUTER_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    process.env.OPENROUTER_API_KEY = "local-test-key";
    process.env.OPENROUTER_MODEL = "test/requested";
    process.env.AGENT_MAX_ATTEMPTS = "1";
  });

  beforeEach(() => {
    requests = [];
    status = 200;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    process.env = { ...originalEnv };
  });

  it("envia chat, quiz e insights por HTTP com seus prompts e modelo", async () => {
    expect(await askOpenRouter([{ role: "user", content: "chat" }])).toMatchObject({ provider: "openrouter", text: "Resposta HTTP" });
    expect(await askQuizAiAgent("quiz")).toMatchObject({ provider: "openrouter", text: "Resposta HTTP" });
    expect(await askDashboardInsightsAgent("insights")).toEqual({ text: "Resposta HTTP" });
    expect(requests).toHaveLength(3);
    const prompts = ["PROMPT_CHAT.md", "PROMPT_QUIZ.md", "PROMPT_DASHBOARD_INSIGHTS.md"];
    requests.forEach((request, index) => {
      expect(request.path).toBe("/api/v1/chat/completions");
      expect(request.authorization).toBe("Bearer local-test-key");
      expect(request.body.model).toBe("test/requested");
      expect(request.body.messages[0]).toEqual({ role: "system", content: readFileSync(prompts[index], "utf8").trim() });
      expect(request.body.messages[1].role).toBe("user");
    });
  });

  it("recebe streaming SSE por uma conexao HTTP real", async () => {
    const onToken = jest.fn();
    expect(await streamOpenRouter([{ role: "user", content: "chat" }], { onToken })).toMatchObject({ provider: "openrouter", text: "Olá" });
    expect(onToken).toHaveBeenCalledWith("Olá");
    expect(requests[0].body.stream).toBe(true);
  });

  it.each([401, 402])("trata HTTP %s sem exibir sucesso nem retentar", async (code) => {
    status = code;
    process.env.AGENT_MAX_ATTEMPTS = "3";
    expect(await askOpenRouter([{ role: "user", content: "chat" }])).toBeNull();
    await expect(askQuizAiAgent("quiz")).rejects.toMatchObject({ statusCode: 503 });
    await expect(askDashboardInsightsAgent("insights")).rejects.toMatchObject({ statusCode: 503 });
    expect(requests).toHaveLength(3);
  });
});
