import request from "supertest";
import { app } from "../server";
import { practiceFeature, resolveChain } from "../services/features/featureService";

jest.mock("../db/client", () => ({
  checkDatabase: jest.fn(async () => undefined),
  closeDatabasePool: jest.fn(async () => undefined),
  getDb: jest.fn(),
  getExpressDb: jest.fn(),
}));

describe("feature release rules", () => {
  const chain: Array<["class" | "course" | "institution" | "global", string]> = [["class", "k"], ["course", "c"], ["institution", "i"], ["global", ""]];
  const rule = (scope: string, scopeId: string, enabled: boolean, feature = "exams") => ({ feature, scope, scopeId, enabled });

  it("releases by default and lets the most specific rule win", () => {
    expect(resolveChain([], "exams", chain)).toBe(true);
    expect(resolveChain([rule("global", "", false)], "exams", chain)).toBe(false);
    expect(resolveChain([rule("global", "", false), rule("institution", "i", true)], "exams", chain)).toBe(true);
    expect(resolveChain([rule("institution", "i", true), rule("course", "c", false)], "exams", chain)).toBe(false);
    expect(resolveChain([rule("course", "c", false), rule("class", "k", true)], "exams", chain)).toBe(true);
    expect(resolveChain([rule("class", "other", false), rule("global", "", false, "chat")], "exams", chain)).toBe(true);
  });

  it("maps workbench requests to their exercise type", () => {
    expect(practiceFeature({ query: { type: "translation" }, body: {} } as never)).toBe("practice_translation");
    expect(practiceFeature({ query: {}, body: { type: "parsons" } } as never)).toBe("practice_parsons");
    expect(practiceFeature({ query: {}, body: {} } as never)).toBeNull();
  });

  it("gated areas and the rules API still require a session", async () => {
    for (const path of ["/chat/sessions/x", "/quiz/student/hub", "/exams/student", "/questions", "/features/me", "/features/rules", "/dashboard/effort-matrix"])
      await request(app).get(path).expect(401);
    await request(app).put("/features/rules").send({ feature: "chat", scope: "global", enabled: false }).expect(401);
  });
});
