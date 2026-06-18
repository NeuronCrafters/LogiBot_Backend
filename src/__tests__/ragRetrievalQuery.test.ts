import { buildRagRetrievalQuery } from "../services/generation/ragRetrievalQuery";

describe("buildRagRetrievalQuery", () => {
  it("contextualiza uma pergunta curta de continuacao com JavaScript", () => {
    const result = buildRagRetrievalQuery({
      message: "e uma variavel?",
      history: [
        {
          role: "user",
          content: "como criar uma funcao em javascript?",
        },
        {
          role: "assistant",
          content: "Use a palavra-chave function.",
        },
        {
          role: "user",
          content: "e uma variavel?",
        },
      ],
    });

    expect(result.contextualized).toBe(true);
    expect(result.previousUserMessageCount).toBe(1);
    expect(result.query).toContain("Pergunta atual: e uma variavel?");
    expect(result.query).toContain("como criar uma funcao em javascript?");
    expect(result.query).not.toContain("Use a palavra-chave function.");
  });

  it("preserva duas perguntas anteriores em uma cadeia de continuacoes", () => {
    const result = buildRagRetrievalQuery({
      message: "e let?",
      history: [
        { role: "user", content: "como declarar variaveis em javascript?" },
        { role: "assistant", content: "Voce pode usar var." },
        { role: "user", content: "e const?" },
        { role: "assistant", content: "Const nao pode ser reatribuida." },
        { role: "user", content: "e let?" },
      ],
    });

    expect(result.contextualized).toBe(true);
    expect(result.previousUserMessageCount).toBe(2);
    expect(result.query).toContain("1. e const?");
    expect(result.query).toContain(
      "2. como declarar variaveis em javascript?",
    );
  });

  it("nao mistura o historico em uma nova pergunta autossuficiente", () => {
    const result = buildRagRetrievalQuery({
      message: "como funciona Docker?",
      history: [
        { role: "user", content: "como criar uma funcao em javascript?" },
        { role: "assistant", content: "Use function." },
        { role: "user", content: "como funciona Docker?" },
      ],
    });

    expect(result).toEqual({
      query: "como funciona Docker?",
      contextualized: false,
      previousUserMessageCount: 0,
    });
  });

  it("nao contextualiza quando nao existe pergunta anterior", () => {
    const result = buildRagRetrievalQuery({
      message: "e uma variavel?",
      history: [{ role: "user", content: "e uma variavel?" }],
    });

    expect(result).toEqual({
      query: "e uma variavel?",
      contextualized: false,
      previousUserMessageCount: 0,
    });
  });
});
