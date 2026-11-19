import request from "supertest";
import { app } from "../server";
import { getDb } from "../db/client";

jest.mock("../db/client", () => ({
  checkDatabase: jest.fn(async () => undefined),
  closeDatabasePool: jest.fn(async () => undefined),
  getDb: jest.fn(),
  getExpressDb: jest.fn(),
}));

describe("registration password confirmation", () => {
  const body = { name: "Ana Souza", email: "ana@example.invalid", password: "senha-forte-123", code: "TURMA-1" };

  it.each([
    ["missing", {}],
    ["different", { confirmPassword: "senha-forte-124" }],
  ])("refuses a %s confirmation before touching the database", async (_label, extra) => {
    const response = await request(app).post("/auth/register").set("Accept-Language", "en-US").send({ ...body, ...extra }).expect(400);
    expect(response.body).toMatchObject({ code: "registration.passwordMismatch", message: "The passwords do not match." });
    expect(getDb).not.toHaveBeenCalled();
  });
});
