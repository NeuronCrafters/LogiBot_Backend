import {
  isRetryableAgentError,
  withAgentRetry,
} from "../utils/agentRetry";

function httpError(status: number) {
  return { response: { status } };
}

function networkError(code?: string) {
  // axios preenche `request` quando a requisicao foi feita mas nao houve resposta
  return { code, request: {}, message: "network" };
}

describe("isRetryableAgentError", () => {
  it("retenta em 401/429/5xx", () => {
    expect(isRetryableAgentError(httpError(401))).toBe(true);
    expect(isRetryableAgentError(httpError(429))).toBe(true);
    expect(isRetryableAgentError(httpError(500))).toBe(true);
    expect(isRetryableAgentError(httpError(503))).toBe(true);
  });

  it("NAO retenta em 4xx de validacao", () => {
    expect(isRetryableAgentError(httpError(400))).toBe(false);
    expect(isRetryableAgentError(httpError(403))).toBe(false);
    expect(isRetryableAgentError(httpError(404))).toBe(false);
    expect(isRetryableAgentError(httpError(422))).toBe(false);
  });

  it("retenta em timeout / erro de rede (cold start)", () => {
    expect(isRetryableAgentError(networkError("ECONNABORTED"))).toBe(true);
    expect(isRetryableAgentError(networkError("ETIMEDOUT"))).toBe(true);
    expect(isRetryableAgentError(networkError("ECONNRESET"))).toBe(true);
    expect(isRetryableAgentError(networkError("ENOTFOUND"))).toBe(true);
    // socket hang up sem code, mas com request feito
    expect(isRetryableAgentError(networkError(undefined))).toBe(true);
  });

  it("NAO retenta em abort do usuario", () => {
    expect(isRetryableAgentError({ name: "CanceledError" })).toBe(false);
    expect(isRetryableAgentError({ code: "ERR_CANCELED" })).toBe(false);
    expect(isRetryableAgentError({ name: "AbortError" })).toBe(false);
  });

  it("NAO retenta em erro generico lancado pelo proprio codigo", () => {
    expect(isRetryableAgentError(new Error("JSON invalido"))).toBe(false);
    expect(isRetryableAgentError(new Error("texto vazio"))).toBe(false);
  });
});

describe("withAgentRetry", () => {
  it("retorna no primeiro sucesso sem retentar", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const result = await withAgentRetry(fn, { maxAttempts: 3, delayMs: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retenta ate ter sucesso em erro retentavel", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce("ok");
    const onRetry = jest.fn();
    const result = await withAgentRetry(fn, {
      maxAttempts: 3,
      delayMs: 0,
      onRetry,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("nao excede maxAttempts e relança o ultimo erro", async () => {
    const fn = jest.fn().mockRejectedValue(httpError(500));
    await expect(
      withAgentRetry(fn, { maxAttempts: 3, delayMs: 0 }),
    ).rejects.toEqual(httpError(500));
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("relança de imediato erro nao-retentavel sem novas tentativas", async () => {
    const fn = jest.fn().mockRejectedValue(httpError(400));
    await expect(
      withAgentRetry(fn, { maxAttempts: 3, delayMs: 0 }),
    ).rejects.toEqual(httpError(400));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respeita isRetryable customizado", async () => {
    const fn = jest.fn().mockRejectedValue(httpError(503));
    await expect(
      withAgentRetry(fn, {
        maxAttempts: 3,
        delayMs: 0,
        isRetryable: () => false,
      }),
    ).rejects.toEqual(httpError(503));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
