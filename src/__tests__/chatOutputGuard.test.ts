import { assertChatOutput, ChatOutputValidationError, createChatOutputGate, detectProseLanguage } from "../services/ai/chatOutputGuard";

describe("primary chat output validation", () => {
  const prose = {
    "pt-BR": "Uma variável pode guardar um valor para você usar no seu programa e modificar quando precisar. Vamos ver como isso funciona com um exemplo.",
    "en-US": "The variable is a name that you can use to store your data and then change it in your program. This is how it works.",
    "es-ES": "Una variable es un nombre que puedes usar para guardar tus datos en el programa. Los valores se pueden cambiar cuando tienes una nueva entrada.",
  } as const;
  it.each(["pt-BR", "en-US", "es-ES"] as const)("recognizes clear prose in %s and rejects another selected language", language => {
    expect(detectProseLanguage(prose[language])).toBe(language);
    expect(() => assertChatOutput(prose[language], language)).not.toThrow();
    const other = language === "pt-BR" ? "en-US" : "pt-BR";
    expect(() => assertChatOutput(prose[language], other)).toThrow(ChatOutputValidationError);
  });
  it("preserves programming syntax, identifiers, quoted text and short ambiguous responses", () => {
    const code = '```python\nif this_is_valid and not has_error:\n    print("the value is stored in your variable")\n```';
    expect(() => assertChatOutput(`${prose["pt-BR"]}\n${code}\n> ${prose["en-US"]}`, "pt-BR")).not.toThrow();
    expect(() => assertChatOutput(code, "pt-BR")).not.toThrow();
    expect(() => assertChatOutput(`A tradução é: “${prose["en-US"]}”`, "pt-BR")).not.toThrow();
    expect(detectProseLanguage("OK. Python, JavaScript e C++. ")).toBeNull();
  });
  it("holds fragmented prefixes until the primary check can run and flushes short answers at completion", () => {
    const wrong = createChatOutputGate("pt-BR");
    expect(wrong.push("The variable is ")).toBe("");
    expect(() => wrong.push("a name that you can use to store your data.")).toThrow(ChatOutputValidationError);
    const valid = createChatOutputGate("pt-BR");
    expect(valid.push("Olá ")).toBe("");
    expect(valid.push("mundo!")).toBe("");
    expect(valid.finish()).toBe("Olá mundo!");
  });
  it("does not forward leaked channel markers as an answer", () => {
    expect(() => assertChatOutput("We are ChatGPT instructed to be LogiBot tutor. <end>Variáveis são valores.", "en-US")).toThrow(ChatOutputValidationError);
    expect(() => assertChatOutput("```html\n<analysis>Exemplo de tag</analysis>\n```", "pt-BR")).not.toThrow();
  });
});
