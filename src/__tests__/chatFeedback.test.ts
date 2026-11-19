import request from "supertest";
import { app } from "../server";
import { mainRole, parseFeedback, satisfaction, summaryConditions } from "../services/chat/chatFeedbackService";

jest.mock("../db/client", () => ({
  checkDatabase: jest.fn(async () => undefined),
  closeDatabasePool: jest.fn(async () => undefined),
  getDb: jest.fn(),
  getExpressDb: jest.fn(),
}));

const codeOf = (run: () => unknown) => { try { run(); } catch (error) { return (error as { code?: string }).code; } return undefined; };

describe("chat answer feedback", () => {
  it("accepts useful, more or less and not useful", () => {
    expect(parseFeedback({ rating: "up", reason: "unclear", comment: "x" })).toEqual({ rating: "up", reason: null, comment: null });
    expect(parseFeedback({ rating: "partial", reason: "incomplete", comment: "  faltou exemplo  " })).toEqual({ rating: "partial", reason: "incomplete", comment: "faltou exemplo" });
    expect(parseFeedback({ rating: "down", comment: "   " })).toEqual({ rating: "down", reason: null, comment: null });
  });

  it("rejects unknown ratings, reasons and long comments", () => {
    expect(codeOf(() => parseFeedback({ rating: "meh" }))).toBe("chatFeedback.ratingInvalid");
    expect(codeOf(() => parseFeedback(null))).toBe("chatFeedback.ratingInvalid");
    expect(codeOf(() => parseFeedback({ rating: "down", reason: "rude" }))).toBe("chatFeedback.reasonInvalid");
    expect(codeOf(() => parseFeedback({ rating: "down", comment: 3 }))).toBe("chatFeedback.commentInvalid");
    expect(codeOf(() => parseFeedback({ rating: "down", comment: "a".repeat(501) }))).toBe("chatFeedback.commentTooLong");
  });

  it("scores more or less as half and groups each account by its highest role", () => {
    expect(satisfaction(2, 2, 4)).toBe(0.75);
    expect(satisfaction(0, 0, 0)).toBeNull();
    expect(mainRole(["student", "professor"])).toBe("professor");
    expect(mainRole(["professor", "course-coordinator"])).toBe("course-coordinator");
    expect(mainRole([])).toBe("unknown");
  });

  it("validates the institution, course and class filters", () => {
    const id = "10000000-0000-4000-8000-000000000001";
    expect(summaryConditions({})).toHaveLength(0);
    expect(summaryConditions({ institutionId: id, courseId: id, classId: "" })).toHaveLength(2);
    expect(codeOf(() => summaryConditions({ courseId: "x" }))).toBe("chatFeedback.filterInvalid");
    expect(codeOf(() => summaryConditions({ classId: ["a"] }))).toBe("chatFeedback.filterInvalid");
  });

  it("routes require a session", async () => {
    await request(app).put("/chat-feedback/messages/x").send({ rating: "up" }).expect(401);
    await request(app).get("/chat-feedback/sessions/s").expect(401);
    await request(app).get("/chat-feedback/summary").expect(401);
  });
});
