import axios from "axios";
import { Readable } from "stream";
import { askOpenRouter, streamOpenRouter, isOpenRouterConfigured } from "../services/ai/openRouterService";
import { getOpenRouterConfig, prepareOpenRouterMessages } from "../services/ai/openRouterConfig";
import { t, withLanguage } from "../i18n";

jest.mock("axios");
const mockedPost = axios.post as jest.Mock;
const messages = [{ role: "user" as const, content: "oi" }];
const response = { data: { choices: [{ message: { content: "resposta" } }] } };

function stream(...parts: (string | Buffer)[]) {
  return { data: Readable.from(parts) };
}

function token(content: string) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

describe("OpenRouter", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockedPost.mockReset();
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_MODEL = "test/model";
    delete process.env.OPENROUTER_BASE_URL;
    process.env.AGENT_RETRY_DELAY_MS = "1";
    process.env.AGENT_MAX_ATTEMPTS = "3";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("envia modelo, autenticacao, prompt e historico para o endpoint correto", async () => {
    mockedPost.mockResolvedValue(response);
    expect(await askOpenRouter(messages)).toEqual({ text: "resposta", provider: "openrouter" });
    expect(mockedPost).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      { model: "test/model", messages: [expect.objectContaining({ role: "system", content: expect.any(String) }), ...messages, { role: "system", content: t("chat.responseLanguage") }], reasoning: { exclude: true } },
      expect.objectContaining({ headers: { Authorization: "Bearer test-key", "Content-Type": "application/json" } }),
    );
    expect(messages).toEqual([{ role: "user", content: "oi" }]);
  });

  it.each(["OPENROUTER_API_KEY", "OPENROUTER_MODEL"])("nao chama o provedor sem %s", async (name) => {
    delete process.env[name];
    expect(isOpenRouterConfigured()).toBe(false);
    expect(await askOpenRouter(messages)).toBeNull();
    expect(await streamOpenRouter(messages)).toBeNull();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it.each([
    ["https://openrouter.ai/api/v1/", "https://openrouter.ai/api/v1/chat/completions"],
    ["https://openrouter.ai/api/v1/chat/completions", "https://openrouter.ai/api/v1/chat/completions"],
    ["http://localhost:9999/v1", "http://localhost:9999/v1/chat/completions"],
  ])("normaliza a URL %s", (base, endpoint) => {
    process.env.OPENROUTER_BASE_URL = base;
    expect(getOpenRouterConfig()?.endpoint).toBe(endpoint);
  });

  it("preserva o contrato tecnico Self-RAG sem acrescentar o prompt pedagogico", async () => {
    mockedPost.mockResolvedValue(response);
    const decision = [{ role: "system" as const, content: "Responda somente JSON" }, ...messages];
    await askOpenRouter(decision, { includeChatPrompt: false });
    expect(mockedPost.mock.calls[0][1].messages).toEqual(decision);
  });

  it.each(["chat", "quiz", "insights"] as const)("carrega o prompt de %s", (purpose) => {
    const prepared = prepareOpenRouterMessages(purpose, messages);
    expect(prepared[0].role).toBe("system");
    expect(prepared[0].content.length).toBeGreaterThan(100);
    expect(prepared.slice(1, purpose === "chat" ? -1 : undefined)).toEqual(messages);
  });

  it("retenta falhas HTTP transitorias", async () => {
    mockedPost.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce(response);
    expect(await askOpenRouter(messages)).toEqual({ text: "resposta", provider: "openrouter" });
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });

  it("retenta erro do provedor mesmo com HTTP 200", async () => {
    mockedPost.mockResolvedValueOnce({ data: { error: { code: 503, message: "Unavailable" } } }).mockResolvedValueOnce(response);
    expect(await askOpenRouter(messages)).toEqual({ text: "resposta", provider: "openrouter" });
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 402, 403])("nao retenta HTTP %s", async (status) => {
    mockedPost.mockRejectedValue({ response: { status } });
    expect(await askOpenRouter(messages)).toBeNull();
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it("retorna null apos esgotar tentativas", async () => {
    mockedPost.mockRejectedValue({ response: { status: 500 } });
    expect(await askOpenRouter(messages)).toBeNull();
    expect(mockedPost).toHaveBeenCalledTimes(3);
  });

  it("processa SSE fragmentado, comentarios, UTF-8 e uso de tokens", async () => {
    const encoded = Buffer.from(": OPENROUTER PROCESSING\r\n\r\n" + token("Olá ") + token("mundo") + 'data: {"choices":[],"usage":{"total_tokens":4}}\n\ndata: [DONE]\n\n');
    mockedPost.mockResolvedValue(stream(...Array.from(encoded, (byte) => Buffer.from([byte]))));
    const onToken = jest.fn();
    expect(await streamOpenRouter(messages, { onToken })).toEqual({ text: "Olá mundo", provider: "openrouter", usage: { total_tokens: 4 } });
    expect(onToken.mock.calls.flat().join("")).toBe("Olá mundo");
    expect(mockedPost.mock.calls[0][1]).toMatchObject({ model: "test/model", stream: true });
  });

  it("retenta SSE que falha antes do primeiro token", async () => {
    mockedPost.mockResolvedValueOnce(stream('data: {"error":{"code":503}}\n\n')).mockResolvedValueOnce(stream(token("ok"), "data: [DONE]\n\n"));
    expect((await streamOpenRouter(messages))?.text).toBe("ok");
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });

  it("propaga erro apos tokens sem repetir o stream", async () => {
    mockedPost.mockResolvedValue(stream(token("Uma variável pode guardar um valor para você usar no seu programa e modificar quando precisar."), 'data: {"error":{"code":503}}\n\n'));
    const onToken = jest.fn();
    await expect(streamOpenRouter(messages, { onToken })).rejects.toMatchObject({ response: { status: 503 } });
    expect(onToken).toHaveBeenCalledTimes(1);
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it("rejeita stream incompleto depois de uma resposta parcial", async () => {
    mockedPost.mockResolvedValue(stream(token("Uma variável pode guardar um valor para você usar no seu programa e modificar quando precisar.")));
    await expect(streamOpenRouter(messages)).rejects.toMatchObject({ response: { status: 502 } });
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it("blocks the wrong language before any token is displayed and retries once with the selected language", async () => {
    const wrong = "The variable is a name that you can use to store your data and then change it in your program.";
    const correct = "Uma variável pode guardar um valor para você usar no seu programa e modificar quando precisar.";
    mockedPost.mockResolvedValueOnce(stream(token(wrong), "data: [DONE]\n\n"))
      .mockResolvedValueOnce(stream(token(correct), "data: [DONE]\n\n"));
    const onToken = jest.fn();
    const input = [{ role: "system" as const, content: "Always answer in English." }, { role: "user" as const, content: "Explain variables in English." }];
    const result = await withLanguage("pt-BR", () => streamOpenRouter(input, { onToken }));
    expect(result?.text).toBe(correct);
    expect(onToken.mock.calls.flat().join("")).toBe(correct);
    expect(mockedPost).toHaveBeenCalledTimes(2);
    expect(mockedPost.mock.calls[1][1].messages.at(-1).content).toBe(t("chat.responseLanguageRetry"));
    expect(input[1].content).toBe("Explain variables in English.");
  });

  it("returns a localized error if both attempts fail validation without leaking rejected output", async () => {
    mockedPost.mockImplementation(() => Promise.resolve(stream(token("The variable is a name that you can use to store your data and then change it in your program."), "data: [DONE]\n\n")));
    const onToken = jest.fn();
    await expect(withLanguage("pt-BR", () => streamOpenRouter(messages, { onToken }))).rejects.toMatchObject({ code: "chat.outputValidationFailed", message: t("chat.outputValidationFailed") });
    expect(onToken).not.toHaveBeenCalled();
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });

  it("ignores provider reasoning fields and requests their exclusion", async () => {
    mockedPost.mockResolvedValue(stream('data: {"choices":[{"delta":{"reasoning":"Internal reasoning"}}]}\n\n', token("Olá, vamos praticar!"), "data: [DONE]\n\n"));
    const onToken = jest.fn();
    expect((await streamOpenRouter(messages, { onToken }))?.text).toBe("Olá, vamos praticar!");
    expect(onToken.mock.calls.flat().join("")).toBe("Olá, vamos praticar!");
    expect(mockedPost.mock.calls[0][1].reasoning).toEqual({ exclude: true });
  });

  it("rejects internal markers in content even when they use the selected language", async () => {
    mockedPost.mockResolvedValueOnce(stream(token("<think>Vamos analisar a pergunta</think>"), "data: [DONE]\n\n"))
      .mockResolvedValueOnce(stream(token("Uma variável guarda um valor."), "data: [DONE]\n\n"));
    const onToken = jest.fn();
    await streamOpenRouter(messages, { onToken });
    expect(onToken.mock.calls.flat().join("")).toBe("Uma variável guarda um valor.");
  });

  it("nao inicia chamada cancelada", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(streamOpenRouter(messages, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("remove chamadas canceladas da fila sem enviar ao provedor", async () => {
    process.env.OPENROUTER_MAX_CONCURRENCY = "1";
    let finish: (value: typeof response) => void;
    mockedPost.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const first = askOpenRouter(messages);
    await Promise.resolve();
    const controller = new AbortController();
    const second = streamOpenRouter(messages, { signal: controller.signal });
    const rejected = expect(second).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejected;
    finish(response);
    await first;
    expect(mockedPost).toHaveBeenCalledTimes(1);
    mockedPost.mockResolvedValueOnce(response);
    expect((await askOpenRouter(messages))?.text).toBe("resposta");
  });

  it("libera a vaga apos falha e aplica o limite de fila", async () => {
    process.env.OPENROUTER_MAX_CONCURRENCY = "1";
    process.env.OPENROUTER_QUEUE_MAX_SIZE = "0";
    let finish: (value: typeof response) => void;
    mockedPost.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const first = askOpenRouter(messages);
    await Promise.resolve();
    expect(await askOpenRouter(messages)).toBeNull();
    finish(response);
    await first;
    mockedPost.mockResolvedValueOnce(response);
    expect((await askOpenRouter(messages))?.text).toBe("resposta");
  });
});
