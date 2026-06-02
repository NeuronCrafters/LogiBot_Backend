import request from "supertest";
import { app } from "../server";

jest.mock("../db/client", () => ({
  checkDatabase: jest.fn(async () => undefined),
  closeDatabasePool: jest.fn(async () => undefined),
  getDb: jest.fn(),
  getExpressDb: jest.fn(),
}));

describe("Node Express app", () => {
  it("responds to simple health checks without opening a port", async () => {
    await request(app).get("/health/simple").expect(200, "OK");
    await request(app).get("/ping").expect(200, "pong");
  });

  it("reports node-express runtime on /health", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.body).toMatchObject({
      status: "ok",
      runtime: "node-express",
      database: "ok",
    });
  });
});

