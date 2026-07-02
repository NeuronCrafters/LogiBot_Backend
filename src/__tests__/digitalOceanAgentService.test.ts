import axios from "axios";
import {
  askDigitalOceanAgent,
  convertSystemMessages,
  type AgentMessage,
} from "../services/ai/digitalOceanAgentService";

jest.mock("axios");
const mockedPost = axios.post as jest.Mock;

describe("convertSystemMessages", () => {
  it("anexa as instrucoes a pergunta mais recente, sem alterar a primeira pergunta", () => {
    const messages: AgentMessage[] = [
      { role: "system", content: "Use o contexto recuperado." },
      { role: "user", content: "Primeira pergunta" },
      { role: "assistant", content: "Resposta anterior" },
      { role: "user", content: "Pergunta atual" },
    ];

    const converted = convertSystemMessages(messages);

    expect(converted).toHaveLength(3);
    expect(converted[0]).toEqual({
      role: "user",
      content: "Primeira pergunta",
    });
    expect(converted[1]).toEqual({
      role: "assistant",
      content: "Resposta anterior",
    });
    expect(converted[2].role).toBe("user");
    expect(converted[2].content).toContain(
      "<instrucoes_da_aplicacao>\nUse o contexto recuperado.",
    );
    expect(converted[2].content).toContain(
      "<pergunta_atual>\nPergunta atual\n</pergunta_atual>",
    );
    expect(converted.some((message) => message.role === "system")).toBe(false);
  });

  it("combina varias mensagens de sistema na pergunta atual", () => {
    const converted = convertSystemMessages([
      { role: "system", content: "Instrucao A" },
      { role: "system", content: "Instrucao B" },
      { role: "user", content: "Pergunta" },
    ]);

    expect(converted).toHaveLength(1);
    expect(converted[0].content).toContain("Instrucao A\n\nInstrucao B");
    expect(converted[0].content).toContain(
      "<pergunta_atual>\nPergunta\n</pergunta_atual>",
    );
  });

  it("mantem mensagens sem instrucao de sistema", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "Pergunta sem contexto adicional" },
    ];

    expect(convertSystemMessages(messages)).toEqual(messages);
  });
});

describe("askDigitalOceanAgent retry", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DIGITALOCEAN_AGENT_1_ENDPOINT = "https://agent.example.com";
    process.env.DIGITALOCEAN_AGENT_1_ACCESS_KEY = "key";
    process.env.AGENT_RETRY_DELAY_MS = "1";
    process.env.AGENT_MAX_ATTEMPTS = "3";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const messages: AgentMessage[] = [{ role: "user", content: "oi" }];

  it("reexecuta o POST em cold start (5xx) e retorna o texto no sucesso", async () => {
    mockedPost
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce({
        data: { choices: [{ message: { content: "resposta" } }] },
      });

    const result = await askDigitalOceanAgent(messages);

    expect(result).toEqual({ text: "resposta", provider: "digitalocean-agent" });
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });

  it("retorna null apos esgotar as tentativas (preserva fallback do chat)", async () => {
    mockedPost.mockRejectedValue({ response: { status: 500 } });

    const result = await askDigitalOceanAgent(messages);

    expect(result).toBeNull();
    expect(mockedPost).toHaveBeenCalledTimes(3);
  });

  it("nao retenta em erro nao-transitorio (4xx)", async () => {
    mockedPost.mockRejectedValue({ response: { status: 400 } });

    const result = await askDigitalOceanAgent(messages);

    expect(result).toBeNull();
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });
});
