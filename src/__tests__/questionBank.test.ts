import request from "supertest";
import { app } from "../server";
import { randomLineIds } from "../services/questions/questionBankService";

jest.mock("../db/client", () => ({
  checkDatabase: jest.fn(async () => undefined),
  closeDatabasePool: jest.fn(async () => undefined),
  getDb: jest.fn(),
  getExpressDb: jest.fn(),
}));

describe("question bank", () => {
  it("requires a session", async () => {
    await request(app).get("/questions").expect(401);
    await request(app).post("/questions").send({}).expect(401);
  });

  it("creates unique line ids that do not follow the solution order", () => {
    const make = randomLineIds();
    const ids = Array.from({ length: 30 }, (_, index) => make("line", index));
    expect(new Set(ids).size).toBe(30);
    ids.forEach((id) => expect(id).toMatch(/^ln[0-9a-f]{10}$/));
    expect(ids.join(",")).not.toBe([...ids].sort().join(","));
  });
});
