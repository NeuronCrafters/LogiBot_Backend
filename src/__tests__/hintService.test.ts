import { withLanguage } from "../i18n";
import { buildHintContext, conceptLabel } from "../services/exercises/hintService";

const truthTable = {
  exerciseType: "truth_table", exerciseId: "tt-1", concepts: ["conditional", "negation"],
  submittedState: { formula: "p → ¬q", cells: {} },
  result: { wrong: [{ row: 1, column: "p → ¬q", concept: "conditional" }], empty: 0, total: 8 },
} as never;
const translation = {
  exerciseType: "translation", exerciseId: "translation:tr-rain-street", concepts: ["conditional"],
  submittedState: { answer: "q -> p" },
  result: { counterexample: { p: true, q: false }, answerValue: true, expectedValue: false },
} as never;
const parsons = {
  exerciseType: "parsons", exerciseId: "parsons:pa-even-odd", concepts: ["selection"],
  submittedState: {}, result: { misplaced: 2, wrongIndent: 1, distractors: 1, missing: 0 },
} as never;

describe("workbench hints", () => {
  it("names concepts in the request language", () => {
    expect(withLanguage("pt-BR", () => conceptLabel("conditional"))).toBe("condicional");
    expect(withLanguage("en-US", () => conceptLabel("selection"))).toBe("selection (if/else)");
    expect(withLanguage("pt-BR", () => conceptLabel("unknown_thing"))).toBe("unknown thing");
  });

  it("describes a truth-table mistake without the values and rejects texts that fill the table", () => {
    const context = withLanguage("pt-BR", () => buildHintContext(truthTable, "pt-BR"));
    expect(context.concepts).toEqual(["conditional"]);
    expect(context.facts).toContain("coluna p → ¬q, linha 2");
    expect(context.leaks("A coluna fica V F V V nas linhas.")).toBe(true);
    expect(context.leaks("| p | q |\n|---|---|\n| V | F |")).toBe(true);
    expect(context.leaks("Lembre: o condicional só é falso quando o antecedente é verdadeiro e o consequente é falso.")).toBe(false);
    expect(withLanguage("pt-BR", () => context.fallback(2))).toBe("Confira a coluna p → ¬q na linha 2: aplique a regra de condicional aos valores dessa linha.");
  });

  it("never lets the correct translation through, however it is spaced", () => {
    const context = withLanguage("pt-BR", () => buildHintContext(translation, "pt-BR"));
    expect(context.facts).toContain("Se chove, então a rua fica molhada.");
    expect(context.facts).toContain("q -> p");
    expect(context.leaks("A resposta é p→q.")).toBe(true);
    expect(context.leaks("Pense em qual proposição vem depois do \"então\".")).toBe(false);
    expect(withLanguage("pt-BR", () => context.fallback(2))).toContain("p = verdadeiro, q = falso");
  });

  it("does not dictate the algorithm order", () => {
    const context = withLanguage("pt-BR", () => buildHintContext(parsons, "pt-BR"));
    expect(context.facts).toContain("Linhas fora de ordem: 2");
    expect(context.leaks("Comece com leia(n) e depois se n % 2 = 0 então.")).toBe(true);
    expect(context.leaks("```\nleia(n)\n```")).toBe(true);
    expect(context.leaks("Primeiro o algoritmo precisa receber o número.")).toBe(false);
    expect(withLanguage("en-US", () => context.fallback(3))).toMatch(/^Try a smaller example/);
  });
});
