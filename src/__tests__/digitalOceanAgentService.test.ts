import {
  convertSystemMessages,
  type AgentMessage,
} from "../services/ai/digitalOceanAgentService";

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
